# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
#
#################################################################################

from odoo import api, fields, models
import logging
_logger = logging.getLogger(__name__)

class StockProductionLot(models.Model):
    _inherit = "stock.production.lot"

    @api.model
    def check_lot_by_rpc(self, data):
        
        _logger.info("************data*********:%r",data)
        lot = self.search([("name","=",data.get("name")),("product_id","=",data.get("product_id"))])
        _logger.info("************lot*********:%r",lot)
        if lot:
            return True

class EnableSettings(models.TransientModel):
    _inherit = "res.config.settings"

    @api.model
    def enable_lot_setting(self):
        enable_setting = self.create(dict(group_stock_production_lot = True))
        enable_setting.execute()

class ActionValidateInventory(models.Model):
    _inherit = "stock.quant"

    @api.model
    def validate_inventory(self):
        inventory = self.env.ref('pos_product_by_lot_number.stock_inventory_demo')
        validate = inventory.action_validate()