/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */
odoo.define("pos_product_by_lot_number", function(require) {
    "use strict";
    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');
    const { Gui } = require('point_of_sale.Gui');
    var chrome= require('point_of_sale.Chrome')
    var SuperOrder = models.Order.prototype;
    var SuperOrderline = models.Orderline.prototype;
    var SuperPosModel = models.PosModel;
    const { _t } = require('web.core');
    const PaymentScreen = require('point_of_sale.PaymentScreen');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');

    models.load_models([{
      model: 'stock.production.lot',
      label: 'Serial/Lot Numbers',
      domain:[['product_id.available_in_pos','=',true]],
      fields: ['name', 'product_id', 'product_qty'],
      loaded: function(self, result) {
        self.db.lot_no = {};
        _.each(result, function(data) {
          self.db.lot_no[data.name] = data;
        });
      }
    }]);
  
    models.PosModel = models.PosModel.extend({
      scan_product: function(parsed_code) {
        var self = this;
        var result = SuperPosModel.prototype.scan_product.call(this, parsed_code);
        var data = self.db.lot_no[parsed_code.base_code];
        if (!result) {
          if (data) {
            if (data.product_id) {
              var lot_product = data.product_id;
              this.get_order().add_product(self.db.product_by_id[lot_product[0]], {
                scan: true,
                lot_name: parsed_code.base_code
              });
              return true
            }
          }
        }
        return result;
      }
    });
  
    models.Order = models.Order.extend({
      // add_product_by_type is used to add product
      add_product_by_type: function(product, options) {
          if(this._printed){
              this.destroy();
              return this.pos.get_order().add_product(product, options);
          }
          this.assert_editable();
          options = options || {};
          var line = new models.Orderline({}, {pos: this.pos, order: this, product: product});
          this.fix_tax_included_price(line);
  
          if(options.quantity !== undefined){
              line.set_quantity(options.quantity);
          }
  
          if(options.price !== undefined){
              line.set_unit_price(options.price);
              this.fix_tax_included_price(line);
          }
  
          if (options.price_extra !== undefined){
              line.price_extra = options.price_extra;
              line.set_unit_price(line.get_unit_price() + options.price_extra);
              this.fix_tax_included_price(line);
          }
  
          if(options.lst_price !== undefined){
              line.set_lst_price(options.lst_price);
          }
  
          if(options.discount !== undefined){
              line.set_discount(options.discount);
          }
  
          if (options.description !== undefined){
              line.description += options.description;
          }
  
          if(options.extras !== undefined){
              for (var prop in options.extras) {
                  line[prop] = options.extras[prop];
              }
          }
          if (options.is_tip) {
              this.is_tipped = true;
              this.tip_amount = options.price;
          }
  
          var to_merge_orderline;
          for (var i = 0; i < this.orderlines.length; i++) {
              if(this.orderlines.at(i).can_be_merged_with(line) && options.merge !== false){
                  to_merge_orderline = this.orderlines.at(i);
              }
          }
          if (to_merge_orderline){
              to_merge_orderline.merge(line);
              this.select_orderline(to_merge_orderline);
          } else {
              this.orderlines.add(line);
              this.select_orderline(this.get_last_orderline());
          }
  
          // if (options.draftPackLotLines) {
          //     this.selected_orderline.setPackLotLines(options.draftPackLotLines);
          // }
          if (this.pos.config.iface_customer_facing_display) {
              this.pos.send_current_order_to_customer_facing_display();
          }
        this.select_orderline(this.get_last_orderline());
        // options.draftPackLotLines.newPackLotLines.push({'lot_name':options.lot_name})
        var newPackLotLines = [{'lot_name':options.lot_name}];
        var modifiedPackLotLines = [];
        // this.selected_orderline.setPackLotLines({modifiedPackLotLines,newPackLotLines});
        // --------------------------------------------------------------------------------
        let newPackLotLine;
        for (let newLotLine of newPackLotLines) {
            newPackLotLine = new models.Packlotline({}, { order_line: this });
            newPackLotLine.set({ lot_name: newLotLine.lot_name });
            this.selected_orderline.pack_lot_lines.add(newPackLotLine);
        }
        // Set the quantity of the line based on number of pack lots.
        this.selected_orderline.pack_lot_lines.set_quantity_by_lot();
        // --------------------------------------------------------------------------------
      },
      product_total_by_lot: function(lot_name) {
        var count = 0;
        var lot = this.pos.db.lot_no[lot_name]
        _.each(this.pos.get('orders').models, function(order) {
          _.each(order.get_orderlines(), function(orderline) {
            if (lot && orderline.pack_lot_lines && lot.product_id[0] == orderline.product.id) {
              _.each(orderline.pack_lot_lines.models, function(packlot) {
                if (packlot.attributes["lot_name"] == lot_name) {
                  count += orderline.quantity;
                }
              });
            }
          });
        });
        return count
      },
      product_total_by_serial: function(lot_name,orderline_id) {
        var count = 0;
        var lot = this.pos.db.lot_no[lot_name]
        _.each(this.pos.get('orders').models, function(order) {
          _.each(order.get_orderlines(), function(orderline) {
            if (lot && orderline.pack_lot_lines && orderline.id != orderline_id && lot.product_id[0] == orderline.product.id && orderline.product.tracking == 'serial') {
              _.each(orderline.pack_lot_lines.models, function(packlot) {
                if (packlot.attributes["lot_name"] == lot_name) {
                  count += 1;
                }
              });
            }
          });
        });
        return count
      },
      //get_remanining_products is use to calculate the remaining items in lot once the error popup.
      get_remaining_products: function(lot_name) {
  
        var lot = this.pos.db.lot_no[lot_name]
        if (lot) {
          var remaining_qty = lot.product_qty - this.product_total_by_lot(lot_name) + this.pos.get_order().get_selected_orderline().quantity
        }
        return remaining_qty
      },
      add_product: function(product, options) {
        if (options && options.scan) {
          var quant = this.product_total_by_lot(options["lot_name"]);
          var qty = this.pos.db.lot_no[options["lot_name"]].product_qty;
          var tracking = product.tracking;
          if (tracking == "lot") {
            if (quant < qty) {
              this.add_product_by_type(product, options)
            } else {
              Gui.showPopup('WkLSAlertPopUp', {
                title: "Lot Is Empty!",
                'body': "The quantity of selected product in lot " + options.lot_name + " is Zero."
              });
            }
          } else if (tracking == "serial") {
            if (quant < qty && quant < 1) {
              this.add_product_by_type(product, options)
            } else {
              Gui.showPopup('WkLSAlertPopUp', {
                title: "Serial Number!",
                'body': "Only one product can be added by using serial number " + options.lot_name + "."
              });
            }
          }
        } else{
            return SuperOrder.add_product.call(this, product, options)
        }
      },
      //wk_add_lot automatically allots the scanned lot/serial number to the product in orderline
      wk_add_lot: function(options) {
        var order_line = this.get_selected_orderline();
        var pack_lot_lines = order_line.compute_lot_lines();
        if(pack_lot_lines._byId){
          var pack_lot_lines_keys  = Object.keys(pack_lot_lines._byId);
          if(pack_lot_lines_keys && pack_lot_lines_keys.length > 0){
            var cid = pack_lot_lines_keys[pack_lot_lines_keys.length - 1];
            var lot_name = options["lot_name"];
            var pack_line = pack_lot_lines.get({ cid: cid });
            if(pack_line && lot_name)
              pack_line.set_lot_name(lot_name);
          }
          pack_lot_lines.set_quantity_by_lot();
          this.save_to_db();
          order_line.trigger('change', order_line);
        }
      }
    });
  
    const PosResPaymentScreen = (PaymentScreen) =>
        class extends PaymentScreen {
          async validateOrder(isForceValidate) {
            super.validateOrder(isForceValidate);
            var self = this;
            setTimeout(function(){
              // var self = this
              var order = self.env.pos.get_order()
              if(order.finalized)
                self.update_lot();
            },2000)
          }
          orderline_total_by_lot(lot_name) {
            var count = 0;
            var lot = this.env.pos.db.lot_no[lot_name]
            _.each(this.env.pos.get_order().get_orderlines(), function(orderline) {
              if (lot && orderline.pack_lot_lines && lot.product_id[0] == orderline.product.id) {
                _.each(orderline.pack_lot_lines.models, function(packlot) {
                  if (packlot.attributes["lot_name"] == lot_name && orderline.product.tracking == 'lot') {
                    count += orderline.quantity;
                  }
                  else if(packlot.attributes["lot_name"] == lot_name && orderline.product.tracking == 'serial')
                    count = 1;
                });
              }
            });
            return count
          }
          //update_lot is used to update the lot product quantity according to the validated products by their associated lots
          update_lot(){
            var self = this;
            this.env.pos.db.data = self.env.pos.db.lot_no
            _.each(this.env.pos.db.data, function(lot) {
              var count = self.orderline_total_by_lot(lot.name);
              lot.product_qty = lot.product_qty - count;
            });
          }
        }
    Registries.Component.extend(PaymentScreen, PosResPaymentScreen);
    return PaymentScreen;
  });