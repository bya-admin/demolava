/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */
odoo.define("pos_product_by_lot_number.ProductScreen", function (require) {
	"use strict";

	const {
		_t
	} = require('web.core');
	const ProductScreen = require('point_of_sale.ProductScreen');
	const {
		useListener
	} = require('web.custom_hooks');
	const Registries = require('point_of_sale.Registries');
	var rpc = require('web.rpc');
	const NumberBuffer = require('point_of_sale.NumberBuffer');


	const PosProductScreen = (ProductScreen) =>
		class extends ProductScreen {
			_setValue(val) {
				var order = this.env.pos.get_order();
				var selected_orderline = order.get_selected_orderline();
				var lot = this.env.pos.db.lot_no;

				if (selected_orderline) {
					var mode = this.state.numpadMode;
					if (mode === 'quantity') {
						if (selected_orderline.pack_lot_lines._byId && selected_orderline.pack_lot_lines.models[0]) {
							var lot_name = selected_orderline.pack_lot_lines.models[0].attributes["lot_name"];

							var is_lot = _.find(lot, function (num) {
								return num.name == lot_name;
							});
							var count = order.product_total_by_lot(lot_name) + parseInt(val) - selected_orderline.quantity;
							if (is_lot && (val > lot[lot_name].product_qty || count > lot[lot_name].product_qty)) {
								var value = this.env.pos.get_order().get_remaining_products(lot_name);
								this.showPopup("WkLSAlertPopUp", {
									'title': 'Out Of Quantity!',
									'body': "Maximum products available to add in Lot/Serial Number " + lot_name + " are " + value + "."
								});
								NumberBuffer.reset();
							} else {
								super._setValue(val);
							}

						} else {
							super._setValue(val);
						}
					} else {
						super._setValue(val);
					}

				}
			}
			async _barcodeProductAction(code) {
				var self = this;
				const product = this.env.pos.db.get_product_by_barcode(code.base_code);
				if (!product) {
					var data = self.env.pos.db.lot_no[code.base_code];
				  if (data) {
					if (data.product_id) {
					  var lot_product = data.product_id;
					  this.env.pos.get_order().add_product(self.env.pos.db.product_by_id[lot_product[0]], {
						scan: true,
						lot_name: code.base_code
					  });
					  return true
					}
				  }
				  super._barcodeProductAction(code);
				}
				else
					super._barcodeProductAction(code);
			}

	// =============================_getAddProductOptions=========================================================


			async _getAddProductOptions(product, base_code) {
				let price_extra = 0.0;
				let draftPackLotLines, weight, description, packLotLinesToEdit;
	
				if (this.env.pos.config.product_configurator && _.some(product.attribute_line_ids, (id) => id in this.env.pos.attributes_by_ptal_id)) {
					let attributes = _.map(product.attribute_line_ids, (id) => this.env.pos.attributes_by_ptal_id[id])
									  .filter((attr) => attr !== undefined);
					let { confirmed, payload } = await this.showPopup('ProductConfiguratorPopup', {
						product: product,
						attributes: attributes,
					});
	
					if (confirmed) {
						description = payload.selected_attributes.join(', ');
						price_extra += payload.price_extra;
					} else {
						return;
					}
				}
	
				// Gather lot information if required.
				if (['serial', 'lot'].includes(product.tracking) && (this.env.pos.picking_type.use_create_lots || this.env.pos.picking_type.use_existing_lots)) {
					const isAllowOnlyOneLot = product.isAllowOnlyOneLot();
					if (isAllowOnlyOneLot) {
						packLotLinesToEdit = [];
					} else {
						const orderline = this.currentOrder
							.get_orderlines()
							.filter(line => !line.get_discount())
							.find(line => line.product.id === product.id);
						if (orderline) {
							packLotLinesToEdit = orderline.getPackLotLinesToEdit();
						} else {
							packLotLinesToEdit = [];
						}
					}
					const { confirmed, payload } = await this.showPopup('EditListPopup', {
						title: this.env._t('Lot/Serial Number(s) Required'),
						isSingleItem: isAllowOnlyOneLot,
						array: packLotLinesToEdit,
						product:product,
					});

					if (confirmed) {
						// Segregate the old and new packlot lines
						const modifiedPackLotLines = Object.fromEntries(
							payload.newArray.filter(item => item.id).map(item => [item.id, item.text])
						);
						const newPackLotLines = payload.newArray
							.filter(item => !item.id)
							.map(item => ({ lot_name: item.text }));
	
						draftPackLotLines = { modifiedPackLotLines, newPackLotLines };
					} else {
						// We don't proceed on adding product.
						return;
					}
				}
	
				// Take the weight if necessary.
				if (product.to_weight && this.env.pos.config.iface_electronic_scale) {
					// Show the ScaleScreen to weigh the product.
					if (this.isScaleAvailable) {
						const { confirmed, payload } = await this.showTempScreen('ScaleScreen', {
							product,
						});
						if (confirmed) {
							weight = payload.weight;
						} else {
							// do not add the product;
							return;
						}
					} else {
						await this._onScaleNotAvailable();
					}
				}
	
				if (base_code && this.env.pos.db.product_packaging_by_barcode[base_code.code]) {
					weight = this.env.pos.db.product_packaging_by_barcode[base_code.code].qty;
				}
	
				return { draftPackLotLines, quantity: weight, description, price_extra };



		}

	// ===========================_clickProduct=============================================================

			async _clickProduct(event) {
				var self = this;
				let price_extra = 0.0;
				let packLotLinesToEdit, draftPackLotLines,description,weight;

				const product = event.detail;
				// Gather lot information if required.
				if (['serial', 'lot'].includes(product.tracking)) {
					const isAllowOnlyOneLot = product.isAllowOnlyOneLot();
					if (isAllowOnlyOneLot) {
						packLotLinesToEdit = [];
					} else {
						const orderline = this.currentOrder
							.get_orderlines()
							.filter(line => !line.get_discount())
							.find(line => line.product.id === product.id);
						if (orderline) {
							packLotLinesToEdit = orderline.getPackLotLinesToEdit();
						} else {
							packLotLinesToEdit = [];
						}
					}
					const {
						confirmed,
						payload
					} = await this.showPopup('EditListPopup', {
						title: this.env._t('Lot/Serial Number(s) Required'),
						isSingleItem: isAllowOnlyOneLot,
						array: packLotLinesToEdit,
						product:product,

					});
					if (confirmed) {
						// Segregate the old and new packlot lines
						const modifiedPackLotLines = Object.fromEntries(
							payload.newArray.filter(item => item.id).map(item => [item.id, item.text])
						);
						const newPackLotLines = payload.newArray
							.filter(item => !item.id)
							.map(item => ({
								lot_name: item.text
							}));

						draftPackLotLines = {
							modifiedPackLotLines,
							newPackLotLines
						};
					} else {
						// We don't proceed on adding product.
						return;
					}
					// Take the weight if necessary.
					if (product.to_weight && this.env.pos.config.iface_electronic_scale) {
						// Show the ScaleScreen to weigh the product.
						if (this.isScaleAvailable) {
							const { confirmed, payload } = await this.showTempScreen('ScaleScreen', {
								product,
							});
							if (confirmed) {
								weight = payload.weight;
							} else {
								// do not add the product;
								return;
							}
						} else {
							await this._onScaleNotAvailable();
						}
					}
		
					// Add the product after having the extra information.
					this.currentOrder.add_product(product, {
						draftPackLotLines,
						description: description,
						price_extra: price_extra,
						quantity: weight,
					});
					NumberBuffer.reset();
				}
				else{
					super._clickProduct(event)
				} 
			}
			// on_click_confirm(product){
			// 	var self = this;
			// 	this.validate_lots(product);

			// }
			// validate_lots(product){
			// 	var self = this;
			// 	var count = 0;
			// 	var lot_inputs = {};
			// 	$('.list-line-input').each(function(index,ev){
			// 		var lot_name = $(ev.currenTarget).val();
			// 		console.log("ev",$(ev.currenTarget).val())
			// 		if(Object.keys(lot_inputs).indexOf(lot_name) == -1)
			// 			lot_inputs[lot_name] = 1;
			// 		else
			// 			lot_inputs[lot_name]++;
			// 			console.log("self.env.pos.db.lot_no[lot_name].product_id[0]",self.env.pos.db.lot_no,product)
			// 		if(self.env.pos.db.lot_no[lot_name] && self.env.pos.db.lot_no[lot_name].product_id[0] == product.id)
			// 			count++
			// 		else{

			// 			rpc.query({
			// 				model: 'stock.production.lot',
			// 				method: 'check_lot_by_rpc',
			// 				args: [{
			// 				'name': lot_name,
			// 				'product_id': product.id
			// 				}]
			// 			})
			// 			.then(function(result) {
			// 				if(result){
			// 					count++;
			// 				}
			// 				else{
			// 					$(ev.currenTarget).addClass('wk-error');
			// 				}
			// 			});
			// 		}
			// 	});
			// 	setTimeout(function(){
			// 		_.each(lot_inputs,function(index,val){
			// 			if(val > 1)
			// 				$('.list-line-input').eq(index).addClass('wk-error');
			// 		})

			// 	},1000);

			// }
		}

	Registries.Component.extend(ProductScreen, PosProductScreen);

	return ProductScreen;
});
