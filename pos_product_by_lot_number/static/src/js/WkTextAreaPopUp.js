odoo.define('pos_product_by_lot_number.EditListPopup', function (require) {
    'use strict';
    const rpc = require('web.rpc');
    const Registries = require('point_of_sale.Registries');
    const EditListPopup = require('point_of_sale.EditListPopup');
    var Qweb = require('web.core').qweb;
    var SuperConfirm = EditListPopup.prototype.confirm;

    const PosEditListPopup = (EditListPopup) =>
        class extends EditListPopup {
            async confirm(){
                this.on_click_confirm(this.props.product);
                
            }
			on_click_confirm(product){
				var self = this;
				this.validate_lots(product);
                    setTimeout(function(){
                        var has_error = false;
                        $('.list-line-input').each(function(index,el){
                            if($(el).hasClass('wk-error'))
                            has_error = true;
                        });
                        var selection = $('.select-input option:selected').val();

                    if(!has_error){
                        SuperConfirm.call(self);
                    }
                    else if(has_error && selection == 'yes'){
                        SuperConfirm.call(self);
                        // super.confirm();
                    }
                },500)
			}
			async validate_lots(product){
				var self = this;
				var count = 0;
                var lot_inputs = {};
                var wrong_elements = [];
                $('.list-line-input').removeClass('wk-error');
                $('.duplicate-serial').hide();
                $('.error-message').hide();
				$('.list-line-input').each(function(index,ev){
					var lot_name = $(ev).val();
                    if(product.tracking == 'serial')
                        if(Object.keys(lot_inputs).indexOf(lot_name) == -1)
                            lot_inputs[lot_name] = 1;
                        else
                            lot_inputs[lot_name]++;
                    this.has_error = false;
					if(self.env.pos.db.lot_no[lot_name] && self.env.pos.db.lot_no[lot_name].product_id[0] == product.id){
                        this.has_error = true;
                        // count++
                    }
					else{
                        
                        rpc.query({
                            model: 'stock.production.lot',
							method: 'check_lot_by_rpc',
							args: [{
                                'name': lot_name,
                                'product_id': product.id
							}]
						})
						.then(function(result) {
							if(result){
                                // count++;
							}
							else{
								$(ev).addClass('wk-error');
                                wrong_elements.push($(ev))
							}
						}).catch(function(e){
                            if(this.has_error)
                                $(ev).addClass('wk-error');
                        });
					}
                });
                var is_duplicate = false;
                var duplicate = Object.values(lot_inputs).filter(e => e > 1);
                if(duplicate.length)
                    // setTimeout(function(){
                    _.each(wrong_elements,function(ele){
                        ele.addClass('wk-error')
                    })
                    // },1000);
                    // $('.list-line-input').removeClass('wk-error');
                
                if(product.tracking == 'serial')
                _.each(lot_inputs,function(index,val){
                    if(lot_inputs[val] > 1){
                        is_duplicate = true;
                        $('.list-line-input').each(function(i,e){
                            if($(e).val() == val)
                            $(e).addClass('wk-error');
                        }); 
                        
                    }
                })
                setTimeout(function(){
                    var has_error = false;
                    $('.list-line-input').each(function(index,el){
                        if($(el).hasClass('wk-error'))
                        has_error = true;
                    });
                if(!is_duplicate && has_error){
                    // $()
                    $('.duplicate-serial').hide();
                    $('.error-message').show();
                    // setTimeout(function(){
                    // _.each(wrong_elements,function(ele){
                    //     console.log("eleeeeeeeee",ele)
                    //     ele.addClass('wk-error')
                    // })
                    // },1000);
                }
                else if(is_duplicate && has_error){
                    $('.duplicate-serial').show();
                    $('.error-message').hide();

                }
                else{
                    $('.duplicate-serial').hide();
                    $('.error-message').hide();

                }
            },1000);
                // var has_error = false;
                // $('.list-line-input').each(function(index,el){
                //     console.log("($(el).hasClass('wk-error')",($(el).hasClass('wk-error')));
                //     if($(el).hasClass('wk-error'))
                //         has_error = true;
                // });
                // var selection = $('.select-input option:selected').val();
                // // console.log("selection",selection,has_error)
                // // return {
                // //     'selection':selection,
                // //     has_error:has_error
                // // }
                // // setTimeout(function(){

                // //     if(!has_error){
                // //         console.log("risssssssssssssss")
                // //         // super.confirm();
                // //         SuperConfirm.call(self);
                // //     }
                // //     else if(has_error && selection == 'yes'){
                // //         SuperConfirm.call(self);
                // //         // super.confirm();
                // //     }
                // // },1000)
			}
            mounted() {
                super.mounted();
                var self = this;
                self.index = -1;
                $('.popup').on('focus', '.list-line-input', function (event) {
                    
                    const product = self.props.product;
                    var currentElement = $(event.currentTarget);

                    $(event.currentTarget).removeClass('wk-error');
                    $('.duplicate-serial').hide();
                    var lot_name = currentElement.val()
                    if(product)
                    self.render_lot_holder(event, product, lot_name, currentElement);
                });
                $('.popup').on('keyup', '.list-line-input', function (event) {
                    const product = self.props.product;
                    var currentElement = $(event.currentTarget);
                    var lot_name = ""
                    if (event)
                        lot_name = currentElement.val()
                    if(product)
                    self.render_lot_holder(event, product, lot_name, currentElement);
                })
            }
            render_lot_holder(event, product, lot_name, currentElement) {
                var self = this;
                var product_lot = {};
                var all_lots = self.env.pos.db.lot_no;
                _.each(all_lots, function (lot) {
                    var count = 0;
                    count += self.env.pos.get_order().product_total_by_lot(lot.name);
                    if (lot.product_id[0] == product.id && lot.product_qty > count) {
                        let lot_name = lot.name;
                        product_lot[lot_name] = lot;
                    }
                });
                $('.list-line-input').each(function (index, el) {
                    var text = $(el).val();
                    if ($(el) != currentElement)
                        if (Object.keys(product_lot).indexOf(text) != -1)
                            delete product_lot[text];

                })
                var lot_holder = Qweb.render('LotHolder', {});
                var updown_press;
                
                $('.selection-lot').remove();
                currentElement.siblings().after(lot_holder);
                self.parent = $('.lot-holder');
                    currentElement.parent(1).find('.lot-holder ul').empty();
                if (lot_name != '') {
                    lot_name = new RegExp(lot_name.replace(/[^0-9a-z_]/i), 'i');
                    for (var index in product_lot) {
                        if (product_lot[index].name.match(lot_name)) {
                            currentElement.parent(1).find('.lot-holder ul').append($("<li><span class='lot-name'>" + product_lot[index].name + "</span></li>"));
                        }
                    }
                } else {
                    for (var index in product_lot) {
                        currentElement.parent(1).find('.lot-holder ul').append($("<li><span class='lot-name'>" + product_lot[index].name + "</span></li>"));
                    }

                }
                currentElement.parent(1).find('.lot-holder, .lot-holder ul').show();

                // *************For movement in lot holder********************

                if(event && event.which == 38){
                    // Up arrow
                    self.index--;
                    var len = $('.lot-holder li').length;
                    if(self.index < 0)
                        self.index = len-1;
                    self.parent.scrollTop(36*self.index);
                    updown_press = true;
                }else if(event && event.which == 40){
                    // Down arrow
                    self.index++;
                    if(self.index > $('.lot-holder li').length - 1)
                        self.index = 0;
                    self.parent.scrollTop(36*self.index);
                       updown_press = true;
                }

                if(event && event.which == 27){
                    // Esc key
                    $('.lot-holder ul').hide();
                }else if(event && event.which == 13 && self.index >=0 && $('.lot-holder li').eq(self.index)[0]){
                    var selcted_li_quote_id = $('.lot-holder li').eq(self.index)[0].innerText;
                    currentElement.val(selcted_li_quote_id);
                    currentElement.keyup();
                    var ele;
                    $('.list-line-input').each(function(index,el){
                        if($(el).index() == currentElement.index()){
                            ele = index
                        }
                    })
                    var count = 0;
                    _.each(self.state.array,function(state){
                        if(ele == count)
                        state.text = selcted_li_quote_id;
                        count++;
                    })
                    $('.lot-holder').hide();
                    self.index = -1;
                }
                $('.lot-holder ').on('click','li', function(event) {
                var lot_name = $(event.currentTarget).text();
                    currentElement.val(lot_name)
                    $('.selection-lot').hide();
                    if(currentElement.length)
                        currentElement.focus();
                    else
                        $('.list-line-input').focus();
                        var ele;
                    $('.list-line-input').each(function(index,el){
                        if($(el).index() == currentElement.index()){
                            ele = index
                        }
                    })
                    var count = 0;
                    _.each(self.state.array,function(state){
                        if(ele == count)
                        state.text = lot_name;
                        count++;
                    })
                });
                if (updown_press) {

                    $('.lot-holder li.active').removeClass('active');
                    $('.lot-holder li').eq(self.index).addClass('active');
                    $('.lot-holder li.active').select();
                }
                if (event && event.which == 27) {

                    // Esc key
                    $('.lot-holder ul').hide();

                }

            }
        }
    Registries.Component.extend(EditListPopup, PosEditListPopup);
    return EditListPopup;

    // class WkTextAreaPopup extends AbstractAwaitablePopup {
    //     getPayload() {
    //         return this.value;
    //     }
    //     mounted() {
    //         $('textarea').focus();
    //     }
    // }


    // var PackLotLinePopupWidget = PopupWidget.extend({
    //   template: 'PackLotLinePopupWidget',
    //   events: _.extend({}, PopupWidget.prototype.events, {
    //     'click .remove-lot': 'remove_lot',
    //     'keydown': 'add_lot',
    //     'blur .packlot-line-input': 'lose_input_focus',
    //     'keyup .packlot-line-input': 'lot_key_press_input',
    //     'click .packlot-line-input': 'focus_input',
    //     'click #check_content': 'check_box_element'
    //   }),

    //   show: function(options) {

    //     var self = this;
    //     this._super(options);
    //     this.focus();
    //     self.index = $(".lot-holder li").length / 2 - 1;
    //     self.parent = self.$('.lot-holder');
    //     self.is_add_lot = false;
    //   },

    //   click_cancel: function() {

    //     var self = this
    //     this._super();
    //     _.each(this.pos.get_order().get_selected_orderline().pack_lot_lines.models, function(lot) {
    //       if (lot && lot.error) {
    //         lot.remove();
    //         self.pos.get_order().get_selected_orderline().pack_lot_lines.set_quantity_by_lot();
    //       }
    //     })
    //   },

    //   click_confirm: function() {

    //     var self = this;
    //     var check = 0;
    //     var pack_lot_lines = this.options.pack_lot_lines;
    //     self.pos.get_order().get_selected_orderline().count = 0
    //     self.$('.packlot-line-input').each(function(index, el) {
    //       var cid = $(el).attr('cid'),
    //         lot_name = $(el).val();

    //       //to check whether a lot number is in the data or not

    //       if (self.pos.db.lot_no[lot_name] && self.pos.db.lot_no[lot_name].product_id[0] == self.options.order_line.product.id && self.pos.get_order().get_selected_orderline().count == 0 ) {
    //           check = 1;
    //       }
    //       else if (self.pos.db.lot_no[lot_name] && self.pos.db.lot_no[lot_name].product_id[0] == self.options.order_line.product.id && self.pos.get_order().get_selected_orderline().count >= 1) {
    //           check += 1;
    //       }

    //       if (check == self.$('.packlot-line-input').length) {
    //           var cid = $('.packlot-line-input').attr('cid'),
    //             lot_name = $(el).val();
    //           var pack_line = pack_lot_lines.get({ cid: cid });
    //           pack_line.set_lot_name(lot_name);
    //           pack_lot_lines.remove_empty_model();
    //           pack_lot_lines.set_quantity_by_lot();
    //           self.options.order.save_to_db();
    //           self.options.order_line.trigger('change', self.options.order_line);
    //           self.gui.close_popup();

    //       } else {                                      //to check via rpc

    //         rpc.query({
    //             model: 'stock.production.lot',
    //             method: 'check_lot_by_rpc',
    //             args: [{
    //               'name': lot_name,
    //               'product_id': self.options.order_line.product.id
    //             }]
    //           })
    //           .then(function(result) {

    //             var count = 0;
    //             _.each(pack_lot_lines.models, function(lot) {
    //               if (pack_lot_lines && pack_lot_lines.get({ cid: cid }) && pack_lot_lines.get({ cid: cid }).attributes.lot_name == lot.attributes.lot_name) {
    //                   count += 1;
    //               }
    //             })
    //             self.pos.get_order().get_selected_orderline().count = count;
    //             if (!result ||self.pos.get_order().get_selected_orderline().count > 1 ) {            //if result will not be found
    //                 var selector = "[cid~='" + cid + "']";
    //                 var pack_line = pack_lot_lines.get({ cid: cid });
    //                 self.error = true;
    //                 if(pack_line)
    //                   pack_line.error = true;
    //                 self.$(selector).addClass("wk-error");
    //                 if (self.pos.get_order().get_selected_orderline().count > 1 || self.pos.check ) {
    //                     self.$(".error-message").hide();
    //                     self.$(".duplicate-serial").show();
    //                     self.pos.check = true;
    //                 } else{
    //                     self.$(".error-message").show();
    //                     self.$('.duplicate-serial').hide();
    //                 }
    //             }

    //             if (self.$(".checkbox-input").is(':checked') || result) { //condition whether the checkbox is checked or not

    //                 self.$('.packlot-line-input').each(function(index, el) {
    //                   var cid = $(el).attr('cid'),
    //                     lot_name = $(el).val();
    //                   var pack_line = pack_lot_lines.get({ cid: cid });
    //                   if(pack_line && lot_name)
    //                     pack_line.set_lot_name(lot_name);
    //               });
    //               pack_lot_lines.remove_empty_model();
    //               pack_lot_lines.set_quantity_by_lot();
    //               self.options.order.save_to_db();
    //               self.options.order_line.trigger('change', self.options.order_line);
    //               self.gui.close_popup();
    //               self.error = false;
    //               self.pos.check = false;

    //             }
    //           })
    //       }
    //     })
    //   },

    //   add_lot: function(ev) {
    //     if (ev.keyCode === $.ui.keyCode.ENTER && this.options.order_line.product.tracking == 'serial') {
    //       var pack_lot_lines = this.options.pack_lot_lines,
    //         $input = $(ev.target),
    //         cid = $input.attr('cid'),
    //         lot_name = $input.val();
    //       var lot_model = pack_lot_lines.get({ cid: cid });
    //       lot_model.set_lot_name(lot_name); // First set current model then add new one
    //       if (!pack_lot_lines.get_empty_model()) {
    //         var new_lot_model = lot_model.add();
    //         this.is_add_lot = true;
    //         this.focus_model = new_lot_model;
    //       }
    //       pack_lot_lines.set_quantity_by_lot();
    //       this.renderElement();
    //       this.focus();
    //     } 
    //   },

    //   remove_lot: function(ev) {
    //     var self = this
    //     var pack_lot_lines = this.options.pack_lot_lines,
    //       $input = $(ev.target).prev(),
    //       cid = $input.attr('cid');
    //     var lot_model = pack_lot_lines.get({ cid: cid });
    //     lot_model.remove();
    //     pack_lot_lines.set_quantity_by_lot();
    //     this.renderElement();
    //     self.pos.check = false;


    //   },

    //   lose_input_focus: function(ev) {

    //     var $input = $(ev.target),
    //       cid = $input.attr('cid');
    //     var lot_model = this.options.pack_lot_lines.get({ cid: cid });
    //     lot_model.set_lot_name($input.val());

    //   },

    //   focus: function() {

    //     this.$("input[autofocus]").focus();
    //     this.focus_model = false;            // after focus clear focus_model on widget
    //     this.lot_key_press_input();

    //   },

    //   lot_key_press_input: function(event) {

    //     var self = this;
    //     var updown_press;
    //     var all_lots = self.pos.db.lot_no;
    //     $('.lot-holder ul').empty();
    //     var cid = false;
    //     if(event){
    //       cid = self.$('.packlot-line-input').attr('cid');
    //     }
    //     var lot_name = ""
    //     if(event)
    //       lot_name = currentElement.val()
    //     else
    //       lot_name = self.$('.packlot-line-input').val();
    //     self.$('.lot-holder').show();
    //     var product_lot = {};
    //     _.each(all_lots, function(lot) {
    //       var count = 0;
    //       if(self.pos.get_order().get_selected_orderline().product.tracking == 'lot')
    //         count += self.pos.get_order().product_total_by_lot(lot.name);
    //       else
    //         count += self.pos.get_order().product_total_by_serial(lot.name,self.pos.get_order().get_selected_orderline().id);
    //       if (lot.product_id[0] == self.options.order_line.product.id && lot.product_qty > count) {
    //         var lot_name = lot.name;
    //         product_lot[lot_name] = lot;
    //       }
    //     });
    //     $('.packlot-line-input').each(function(index,el){
    //       var text = $(el).val();
    //       if(Object.keys(product_lot).indexOf(text) != -1)
    //             delete product_lot[text];

    //     })

    //     if(lot_name)
    //       lot_name = new RegExp(lot_name.replace(/[^0-9a-z_]/i), 'i');
    //       for (var index in product_lot) {
    //         if (product_lot[index].name.match(lot_name)) {
    //           $('.lot-holder ul').append($("<li><span class='lot-name'>" + product_lot[index].name + "</span></li>"));
    //         }
    //       }


    //     $('.lot-holder ul').show();
    //     self.$('.lot-holder li').on('click', function() {
    //       var lot_name = $(this).text();
    //       if(event)
    //       currentElement.val(lot_name)
    //       else
    //         self.$(".packlot-line-input").val(lot_name);
    //       $('.selection-lot').hide();
    //       if(event)
    //       currentElement.focus();
    //       else
    //         $('.packlot-line-input').focus();
    //     });

    //     if (event && event.which == 38) {

    //       // Up arrow
    //       self.index--;
    //       var len = $('.lot-holder li').length;
    //       if (self.index < $(".lot-holder li").length / 2)
    //         self.index = len - 1;
    //       self.parent.scrollTop(36 *(self.index - len/2));
    //       updown_press = true;

    //     } else if (event && event.which == 40) {

    //       // Down arrow
    //       self.index++;
    //       var len = $('.lot-holder li').length
    //       if (self.index > len - 1)
    //         self.index = len / 2;
    //       self.parent.scrollTop(36  * (self.index - len/2 ));
    //       updown_press = true;
    //     }

    //     if (updown_press) {

    //       $('.lot-holder li.active').removeClass('active');
    //       $('.lot-holder li').eq(self.index).addClass('active');
    //       $('.lot-holder li.active').select();
    //     }
    //     if (event && event.which == 27) {

    //       // Esc key
    //       $('.lot-holder ul').hide();

    //     }
    //      else if (event && event.which == 13  && self.index >= 0 && $('.lot-holder li').eq(self.index)[0]) {

    //       if(!self.is_add_lot || $('.packlot-line-input').length == 1){
    //         var selcted_li_lot_id = $('.lot-holder li').eq(self.index)[0].innerText;
    //         if(event){
    //           currentElement.val(selcted_li_lot_id);
    //         }
    //         else{
    //           self.$('.packlot-line-input').val(selcted_li_lot_id);
    //         }
    //         $('.lot-holder ul').hide();
    //         self.$('.lot-holder').hide();
    //         self.index = false;
    //         self.$('.packlot-line-input').focusout();
    //       }
    //       else{
    //         self.is_add_lot = false;
    //       }
    //     }

    //   },
    //   focus_input: function(event) {
    //     var self = this;
    //     this.$(".lot-holder").show();
    //     this.$(".packlot-line-input").removeClass("wk-error")
    //     self.$(".error-message").hide();
    //     self.$(".duplicate-serial").hide();
    //     self.index = $(".lot-holder li").length / 2 - 1;
    //     if(event && event.which != 13)
    //       self.lot_key_press_input(event);
    //   },

    //   check_box_element: function() {

    //     if (this.$(".checkbox-input").is(':checked'))
    //       this.$(".checkbox-input").prop('checked', false);
    //     else
    //       this.$(".checkbox-input").prop('checked', true);
    //   }
    // });








    // WkTextAreaPopup.template = 'WkTextAreaPopup';
    // WkTextAreaPopup.defaultProps = {
    //     title: 'Confirm ?',
    //     value:''
    // };

    // Registries.Component.add(WkTextAreaPopup);


    // return WkTextAreaPopup;
});