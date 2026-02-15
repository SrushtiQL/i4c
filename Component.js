sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
    "use strict";

    return UIComponent.extend("fiori.ingredient.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            // Call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // Create global configuration model
            var oConfigModel = new JSONModel({
                pocketbaseURL: "https://recipe-pocketbase.cfapps.eu11.hana.ondemand.com",
                adminEmail: "s.kj@sap.com",
                adminPassword: "1234567890",
                adminToken: null,
                selectedProduct: null,
                selectedCountry: null,
                showResults: false
            });
            this.setModel(oConfigModel, "config");

            // Create the views based on the url/hash
            this.getRouter().initialize();
        }
    });
});
