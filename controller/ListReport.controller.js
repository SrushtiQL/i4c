sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, MessageToast, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("fiori.ingredient.controller.ListReport", {
        onInit: function () {
            // Create model structure
            var oModel = new JSONModel({
                recipes: [],
                selectedRecipe: null,
                filters: {
                    editingStatus: "",
                    recipeType: "",
                    status: "",
                    primaryOutput: "",
                    product: ""
                },
                countries: [],
                availableIngredients: [],
                newRecipe: {
                    productName: "",
                    recipeId: "",
                    regionId: "",
                    selectedIngredientIds: [],
                    recipeType: "Standard"
                },
                // AI Recipe creation
                aiRecipe: {
                    foodName: "",
                    recipeId: "",
                    regionId: "",
                    recipeType: "Standard",
                    ingredients: [],
                    generatingIngredients: false
                }
            });
            this.getView().setModel(oModel);
            
            // Attach to route to refresh data when navigating back
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("listReport").attachPatternMatched(this._onRouteMatched, this);
            
            // Load recipes from API
            this._loadRecipesFromAPI();
            
            // Load countries for create dialog
            this._loadCountriesFromAPI();
            
            // Load available ingredients for create dialog
            this._loadAvailableIngredients();
        },

        _onRouteMatched: function () {
            this._loadRecipesFromAPI();
        },
        _loadCountriesFromAPI: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            // Use the NEW 'country' collection with proper country names
            jQuery.ajax({
                url: sPocketbaseURL + "/api/collections/country/records",
                method: "GET",
                data: {
                    perPage: 500,
                    sort: "name"
                },
                success: function(oData) {
                    // Map country collection fields
                    var aCountries = oData.items.map(function(item) {
                        return {
                            id: item.id,
                            name: item.name || "Unknown",
                            code: item.code || "",
                            fieldId: item.field_id || "",
                            regionFK: item.region_fk || ""
                        };
                    });
                    
                    this.getView().getModel().setProperty("/countries", aCountries);
                }.bind(this),
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error("❌ Failed to load countries:", textStatus, errorThrown);
                }.bind(this)
            });
        },

        _loadAvailableIngredients: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            // Use the NEW 'ingredients' collection instead of old 'IngredientMaster'
            jQuery.ajax({
                url: sPocketbaseURL + "/api/collections/ingredients/records",
                method: "GET",
                data: {
                    perPage: 500,
                    sort: "name"
                },
                success: function(oData) {
                    // Map the ingredients to include all needed fields with proper names
                    var aMappedIngredients = oData.items.map(function(item) {
                        return {
                            id: item.id,
                            INGREDIENT_ID: item.field_id || item.id,
                            INGREDIENT_NAME: item.name || "Unknown",
                            name: item.name || "Unknown",
                            field_id: item.field_id || "",
                            status: item.status || "",
                            functional_role: item.functional_role || "",
                            allergen: item.allergen || 0,
                            base_unit: item.base_unit || ""
                        };
                    });
                    
                    this.getView().getModel().setProperty("/availableIngredients", aMappedIngredients);
                }.bind(this),
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error("❌ Failed to load ingredients:", textStatus, errorThrown);
                }.bind(this)
            });
        },

        _loadRecipesFromAPI: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            // Fetch all records using pagination from NEW recipe collection
            this._fetchAllRecords(sPocketbaseURL, "/api/collections/recipe/records")
                .then(function(aAllItems) {
                    var aRecipes = aAllItems.map(function(item) {
                        // Map new recipe collection fields to UI model
                        return {
                            id: item.field_id || item.id || "",
                            name: item.name || "",
                            alternative: "",
                            version: item.ver ? "v" + item.ver : "",
                            recipeType: item.type || "",
                            status: item.status || "",
                            statusState: item.lifecycle === "Validation" ? "Warning" : 
                                       item.lifecycle === "Active" ? "Success" : "None",
                            primaryOutput: item.name || "",
                            primaryOutputCode: item.field_id ? "(" + item.field_id + ")" : "",
                            product: item.region_fk || "",
                            pocketbaseId: item.id,
                            lifecycle: item.lifecycle || "",
                            productFK: item.product_fk || "",
                            regionFK: item.region_fk || ""
                        };
                    });
                    
                    this.getView().getModel().setProperty("/recipes", aRecipes);
                }.bind(this))
                .catch(function(error) {
                    MessageToast.show("Error loading recipes: " + error.message);
                    console.error("API Error:", error);
                }.bind(this));
        },

        _fetchAllRecords: function (sBaseURL, sEndpoint) {
            return new Promise(function(resolve, reject) {
                var aAllRecords = [];
                var iPage = 1;
                var iPerPage = 500;  // PocketBase max per page
                
                var fetchPage = function() {
                    jQuery.ajax({
                        url: sBaseURL + sEndpoint,
                        method: "GET",
                        data: {
                            page: iPage,
                            perPage: iPerPage
                        },
                        success: function(oData) {
                            var aItems = oData.items || [];
                            aAllRecords = aAllRecords.concat(aItems);
                            
                            // Check if there are more pages
                            if (aItems.length === iPerPage) {
                                // There might be more records, fetch next page
                                iPage++;
                                fetchPage();
                            } else {
                                // Last page reached
                                resolve(aAllRecords);
                            }
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            console.error("❌ Error fetching page " + iPage + ":", textStatus, errorThrown);
                            reject(new Error(textStatus));
                        }
                    });
                };
                
                fetchPage();
            });
        },

        onRecipeSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            var oContext = oSelectedItem.getBindingContext();
            var oRecipe = oContext.getObject();
            
            this.getView().getModel().setProperty("/selectedRecipe", oRecipe);
        },

        onRecipePress: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext ? 
                oSource.getBindingContext() : 
                oSource.getParent().getBindingContext();
            
            if (!oContext) {
                return;
            }
            
            var oRecipe = oContext.getObject();
            
            // Navigate to object page using only recipe ID
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("objectPage", {
                recipeId: oRecipe.id
            });
        },

        onFilterChange: function (oEvent) {
            // Filter change handler - could trigger auto-filter
        },

        onFilterGo: function () {
            var oModel = this.getView().getModel();
            var oFilters = oModel.getProperty("/filters");
            var oTable = this.byId("recipesTable");
            var oBinding = oTable.getBinding("items");

            var aFilters = [];

            // Apply filters based on filter bar values
            if (oFilters.editingStatus && oFilters.editingStatus !== "") {
                aFilters.push(new Filter("status", FilterOperator.EQ, oFilters.editingStatus));
            }

            if (oFilters.recipeType && oFilters.recipeType !== "") {
                aFilters.push(new Filter("recipeType", FilterOperator.Contains, oFilters.recipeType));
            }

            if (oFilters.status && oFilters.status !== "") {
                aFilters.push(new Filter("status", FilterOperator.EQ, oFilters.status));
            }

            oBinding.filter(aFilters);
        },

        onAdaptFilters: function () {
            // TODO: Implement adapt filters dialog
        },

        onCollapseFilters: function () {
            // Filter bar collapsed
        },

        onValueHelp: function (oEvent) {
            // TODO: Implement value help dialog
        },

        // Show Action Sheet with Create options (Manual or AI)
        onCreateRecipe: function (oEvent) {
            // Show Action Sheet with options
            if (!this._oCreateOptionsActionSheet) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "fiori.ingredient.view.CreateOptionsActionSheet",
                    controller: this
                }).then(function(oActionSheet) {
                    this._oCreateOptionsActionSheet = oActionSheet;
                    this.getView().addDependent(oActionSheet);
                    this._oCreateOptionsActionSheet.openBy(oEvent.getSource());
                }.bind(this));
            } else {
                this._oCreateOptionsActionSheet.openBy(oEvent.getSource());
            }
        },

        // Create Manually - Opens existing Create Recipe Dialog
        onCreateManually: function () {
            var oModel = this.getView().getModel();
            
            // Generate unique Recipe ID
            this._generateUniqueRecipeId()
                .then(function(sNewRecipeId) {
                    // Reset newRecipe data
                    oModel.setProperty("/newRecipe", {
                        productName: "",
                        recipeId: sNewRecipeId,
                        regionId: "",
                        selectedIngredientIds: [],
                        recipeType: "Standard"
                    });
                    
                    // Load and open the dialog
                    if (!this._oCreateRecipeDialog) {
                        sap.ui.core.Fragment.load({
                            id: this.getView().getId(),
                            name: "fiori.ingredient.view.CreateRecipeDialog",
                            controller: this
                        }).then(function(oDialog) {
                            this._oCreateRecipeDialog = oDialog;
                            this.getView().addDependent(oDialog);
                            oDialog.open();
                        }.bind(this));
                    } else {
                        this._oCreateRecipeDialog.open();
                    }
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ Failed to generate Recipe ID:", error);
                    MessageToast.show("⚠️ Failed to generate Recipe ID. Please try again.");
                });
        },

        // Create with AI - Opens AI-assisted Create Recipe Dialog
        onCreateWithAI: function () {
            var oModel = this.getView().getModel();
            
            // Generate unique Recipe ID
            this._generateUniqueRecipeId()
                .then(function(sNewRecipeId) {
                    // Reset aiRecipe data
                    oModel.setProperty("/aiRecipe", {
                        foodName: "",
                        recipeId: sNewRecipeId,
                        regionId: "",
                        recipeType: "Standard",
                        ingredients: [],
                        generatingIngredients: false
                    });
                    
                    // Load and open the AI dialog
                    if (!this._oCreateAIRecipeDialog) {
                        sap.ui.core.Fragment.load({
                            id: this.getView().getId(),
                            name: "fiori.ingredient.view.CreateRecipeWithAIDialog",
                            controller: this
                        }).then(function(oDialog) {
                            this._oCreateAIRecipeDialog = oDialog;
                            this.getView().addDependent(oDialog);
                            oDialog.open();
                        }.bind(this));
                    } else {
                        this._oCreateAIRecipeDialog.open();
                    }
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ Failed to generate Recipe ID:", error);
                    MessageToast.show("⚠️ Failed to generate Recipe ID. Please try again.");
                });
        },

        // AI Food Name Change Handler
        onAIFoodNameChange: function (oEvent) {
            // Food name changed
        },

        // AI Region Change Handler
        onAIRegionChange: function (oEvent) {
            // Region changed
        },

        // Generate Ingredients with AI - Calls Recipe Ingredient Agent API
        onGenerateIngredientsAI: function () {
            var oModel = this.getView().getModel();
            var oAIRecipe = oModel.getProperty("/aiRecipe");
            
            // Validate inputs
            if (!oAIRecipe.foodName || oAIRecipe.foodName.trim() === "") {
                MessageToast.show("⚠️ Please enter a food name first");
                return;
            }
            
            if (!oAIRecipe.regionId || oAIRecipe.regionId === "") {
                MessageToast.show("⚠️ Please select a country first");
                return;
            }
            
            // Get country name from selected ID
            var aCountries = oModel.getProperty("/countries");
            var oSelectedCountry = aCountries.find(function(c) {
                return c.id === oAIRecipe.regionId;
            });
            var sLocation = oSelectedCountry ? oSelectedCountry.name : "United States";
            
            // Show loading
            oModel.setProperty("/aiRecipe/generatingIngredients", true);
            MessageToast.show("🤖 Calling AI agent to generate ingredients...");
            
            // Local Regulation Agent API URL
            var sAgentURL = "http://localhost:5001";
            
            // Call the Regulation Agent API
            fetch(sAgentURL + "/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    recipe: oAIRecipe.foodName.trim(),
                    location: sLocation
                })
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("API returned status: " + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                // Check for errors in response
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Map the API response to our ingredients format with alternative items for ComboBox
                var aIngredients = [];
                if (data.main_ingredients && Array.isArray(data.main_ingredients)) {
                    aIngredients = data.main_ingredients.map(function(ing) {
                        // Create alternative items for ComboBox
                        // First item is always "Use Original"
                        var aAlternativeItems = [{
                            key: "",
                            text: "Use Original (" + ing.name + ")",
                            benefits: [],
                            benefitsText: "Original ingredient - no substitution",
                            cost: "",
                            availability: ""
                        }];
                        
                        // Add alternatives from API response
                        if (ing.alternatives && ing.alternatives.length > 0) {
                            ing.alternatives.forEach(function(alt) {
                                // Handle benefits - might be array or string
                                var aBenefits = alt.benefits;
                                if (typeof aBenefits === 'string') {
                                    aBenefits = aBenefits ? [aBenefits] : [];
                                } else if (!Array.isArray(aBenefits)) {
                                    aBenefits = [];
                                }
                                
                                var sBenefitsText = aBenefits.length > 0 ? aBenefits.join(" • ") : "";
                                var sCost = alt.cost_comparison ? alt.cost_comparison.charAt(0).toUpperCase() + alt.cost_comparison.slice(1) : "";
                                var sAvailability = alt.regional_availability ? alt.regional_availability.charAt(0).toUpperCase() + alt.regional_availability.slice(1) : "";
                                
                                aAlternativeItems.push({
                                    key: alt.name,
                                    text: alt.name,
                                    benefits: aBenefits,
                                    benefitsText: sBenefitsText,
                                    cost: sCost,
                                    availability: sAvailability,
                                    dietaryTags: alt.dietary_compatibility || []
                                });
                            });
                        }
                        
                        return {
                            name: ing.name || "Unknown",
                            quantity: ing.quantity || "",
                            alternatives: ing.alternatives || [],
                            alternativeItems: aAlternativeItems,
                            // Track selected alternative
                            selectedAlternative: "",
                            selectedBenefits: [],
                            selectedBenefitsText: "Select an alternative to see benefits",
                            selectedCost: "",
                            selectedAvailability: "",
                            // For display in list
                            displayText: ing.name + (ing.quantity ? " - " + ing.quantity : "")
                        };
                    });
                }
                
                // Update model with ingredients
                oModel.setProperty("/aiRecipe/ingredients", aIngredients);
                oModel.setProperty("/aiRecipe/generatingIngredients", false);
                
                if (aIngredients.length > 0) {
                    MessageToast.show("✅ Generated " + aIngredients.length + " ingredients with alternatives!");
                } else {
                    MessageToast.show("⚠️ No ingredients found. Please try a different food name.");
                }
            }.bind(this))
            .catch(function(error) {
                console.error("❌ AI Agent API error:", error);
                oModel.setProperty("/aiRecipe/generatingIngredients", false);
                MessageToast.show("❌ Failed to generate ingredients: " + error.message);
            }.bind(this));
        },

        // Handle alternative selection change - update benefits display
        onAlternativeSelectionChange: function (oEvent) {
            var oComboBox = oEvent.getSource();
            var oContext = oComboBox.getBindingContext();
            var sPath = oContext.getPath();
            var oModel = this.getView().getModel();
            
            // Get selected key
            var sSelectedKey = oComboBox.getSelectedKey();
            
            // Get the ingredient data
            var oIngredient = oModel.getProperty(sPath);
            
            // Find the selected alternative in alternativeItems
            var oSelectedAlt = oIngredient.alternativeItems.find(function(item) {
                return item.key === sSelectedKey;
            });
            
            if (oSelectedAlt) {
                // Update the selected benefits and other info
                oModel.setProperty(sPath + "/selectedAlternative", sSelectedKey);
                oModel.setProperty(sPath + "/selectedBenefits", oSelectedAlt.benefits || []);
                oModel.setProperty(sPath + "/selectedBenefitsText", oSelectedAlt.benefitsText || "No benefits listed");
                oModel.setProperty(sPath + "/selectedCost", oSelectedAlt.cost || "");
                oModel.setProperty(sPath + "/selectedAvailability", oSelectedAlt.availability || "");
            }
        },

        // Delete an AI-generated ingredient from the list
        onDeleteAIIngredient: function (oEvent) {
            var oModel = this.getView().getModel();
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext();
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop(), 10);
            
            var aIngredients = oModel.getProperty("/aiRecipe/ingredients");
            aIngredients.splice(iIndex, 1);
            oModel.setProperty("/aiRecipe/ingredients", aIngredients);
            
            MessageToast.show("Ingredient removed");
        },

        // Save AI-generated Recipe
        onSaveAIRecipe: function () {
            var oModel = this.getView().getModel();
            var oAIRecipe = oModel.getProperty("/aiRecipe");
            
            // Validate required fields
            if (!oAIRecipe.foodName || oAIRecipe.foodName.trim() === "") {
                MessageToast.show("⚠️ Please enter a food name");
                return;
            }
            
            if (!oAIRecipe.regionId || oAIRecipe.regionId === "") {
                MessageToast.show("⚠️ Please select a region");
                return;
            }
            
            if (!oAIRecipe.ingredients || oAIRecipe.ingredients.length === 0) {
                MessageToast.show("⚠️ Please generate ingredients first");
                return;
            }
            
            // Find region name
            var aCountries = oModel.getProperty("/countries");
            var oRegion = aCountries.find(function(country) {
                return country.id === oAIRecipe.regionId;
            });
            var sRegionFK = oRegion ? oRegion.code || oRegion.id : oAIRecipe.regionId;
            
            // Prepare data for recipe collection
            var oPayload = {
                name: oAIRecipe.foodName.trim(),
                field_id: oAIRecipe.recipeId,
                region_fk: sRegionFK,
                type: oAIRecipe.recipeType || "Standard",
                status: "Draft",
                lifecycle: "Validation",
                ver: 1
            };
            
            MessageToast.show("Creating AI-generated recipe...");
            
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            // Authenticate first, then POST recipe and ingredients
            var sAuthToken;
            var oCreatedRecipe;
            
            this._authenticateAdmin()
                .then(function(sToken) {
                    sAuthToken = sToken;
                    
                    return jQuery.ajax({
                        url: sPocketbaseURL + "/api/collections/recipe/records",
                        method: "POST",
                        headers: { "Authorization": sToken },
                        contentType: "application/json",
                        data: JSON.stringify(oPayload)
                    });
                }.bind(this))
                .then(function(oData) {
                    oCreatedRecipe = oData;
                    
                    // Now save ingredients to recipeingredient collection
                    // Create promises for each ingredient
                    var aIngredientPromises = oAIRecipe.ingredients.map(function(ingredient, index) {
                        // Determine which ingredient to use: original or selected alternative
                        var sIngredientName = ingredient.selectedAlternative || ingredient.name;
                        var sQuantity = ingredient.quantity || "";
                        
                        // Create ingredient record payload using existing PocketBase schema fields
                        var oIngredientPayload = {
                            recipe_fk: oCreatedRecipe.id,
                            ingredient_fk: sIngredientName,  // Store ingredient name in ingredient_fk field
                            originalingredient_fk: ingredient.name,  // Store original name in originalingredient_fk
                            quantity: parseFloat(sQuantity.replace(/[^\d.]/g, '')) || 0,  // Extract number from quantity
                            unit: sQuantity.replace(/[\d.\s]/g, '').trim() || "",  // Extract unit from quantity
                            isalternative: ingredient.selectedAlternative ? 1 : 0,  // 0 or 1
                            functionalrole: ingredient.selectedAlternative ? ingredient.selectedBenefitsText : ""  // Store benefits in functionalrole
                        };
                        
                        return jQuery.ajax({
                            url: sPocketbaseURL + "/api/collections/recipeingredient/records",
                            method: "POST",
                            headers: { "Authorization": sAuthToken },
                            contentType: "application/json",
                            data: JSON.stringify(oIngredientPayload)
                        });
                    });
                    
                    return Promise.all(aIngredientPromises);
                }.bind(this))
                .then(function(aIngredientResults) {
                    // Close dialog
                    this._oCreateAIRecipeDialog.close();
                    
                    // Reload recipe list
                    this._loadRecipesFromAPI();
                    
                    // Navigate to new recipe's ObjectPage using field_id
                    var oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("objectPage", {
                        recipeId: oAIRecipe.recipeId  // Use field_id for URL
                    });
                    
                    MessageToast.show("✅ Recipe '" + oAIRecipe.foodName + "' created with " + aIngredientResults.length + " ingredients!");
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ Failed to create AI recipe:", error);
                    var sErrorMsg = error.responseJSON?.message || error.message || "Unknown error";
                    MessageToast.show("❌ Failed to create recipe: " + sErrorMsg);
                }.bind(this));
        },

        // Cancel AI Recipe creation
        onCancelAIRecipe: function () {
            this._oCreateAIRecipeDialog.close();
        },

        onIngredientSelectionChangeInDialog: function (oEvent) {
            var oMultiComboBox = oEvent.getSource();
            var aSelectedKeys = oMultiComboBox.getSelectedKeys();
            
            this.getView().getModel().setProperty("/newRecipe/selectedIngredientIds", aSelectedKeys);
        },

        onSaveNewRecipe: function () {
            var oModel = this.getView().getModel();
            var oNewRecipe = oModel.getProperty("/newRecipe");
            
            console.log("Creating recipe with data:", oNewRecipe);
            
            // Validate required fields
            if (!oNewRecipe.productName || oNewRecipe.productName.trim() === "") {
                MessageToast.show("⚠️ Please enter a product name");
                return;
            }
            
            if (!oNewRecipe.regionId || oNewRecipe.regionId === "") {
                MessageToast.show("⚠️ Please select a region");
                return;
            }
            
            // Find region name
            var aCountries = oModel.getProperty("/countries");
            var oRegion = aCountries.find(function(country) {
                return country.id === oNewRecipe.regionId;
            });
            var sRegionFK = oRegion ? oRegion.code || oRegion.id : oNewRecipe.regionId;
            
            // Prepare data for NEW recipe collection with correct field names
            var oPayload = {
                name: oNewRecipe.productName.trim(),
                field_id: oNewRecipe.recipeId,
                region_fk: sRegionFK,
                type: oNewRecipe.recipeType || "Standard",
                status: "Draft",
                lifecycle: "Validation",
                ver: 1
            };
            
            MessageToast.show("Creating recipe...");
            
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            // Authenticate first, then POST recipe and ingredients
            var sAuthToken;
            var oCreatedRecipe;
            
            this._authenticateAdmin()
                .then(function(sToken) {
                    sAuthToken = sToken;
                    
                    return jQuery.ajax({
                        url: sPocketbaseURL + "/api/collections/recipe/records",
                        method: "POST",
                        headers: {
                            "Authorization": sToken
                        },
                        contentType: "application/json",
                        data: JSON.stringify(oPayload)
                    });
                }.bind(this))
                .then(function(oData) {
                    oCreatedRecipe = oData;
                    console.log("Recipe created:", oCreatedRecipe);
                    
                    // Now save selected ingredients to recipeingredient collection
                    if (!oNewRecipe.selectedIngredientIds || oNewRecipe.selectedIngredientIds.length === 0) {
                        return Promise.resolve([]);
                    }
                    
                    // Get ingredient details from availableIngredients
                    var aAvailableIngredients = oModel.getProperty("/availableIngredients");
                    
                    // Create promises for each selected ingredient
                    var aIngredientPromises = oNewRecipe.selectedIngredientIds.map(function(sIngredientId) {
                        // Find ingredient details - selectedIngredientIds contains field_id values
                        var oIngredient = aAvailableIngredients.find(function(ing) {
                            return ing.field_id === sIngredientId || ing.INGREDIENT_ID === sIngredientId;
                        });
                        
                        console.log("Creating ingredient link for:", sIngredientId, oIngredient);
                        
                        // Create ingredient record payload
                        var oIngredientPayload = {
                            recipe_fk: oCreatedRecipe.id,
                            ingredient_fk: sIngredientId,
                            originalingredient_fk: sIngredientId,
                            quantity: 0,
                            unit: "",
                            isalternative: 0,
                            functionalrole: ""
                        };
                        
                        return jQuery.ajax({
                            url: sPocketbaseURL + "/api/collections/recipeingredient/records",
                            method: "POST",
                            headers: { "Authorization": sAuthToken },
                            contentType: "application/json",
                            data: JSON.stringify(oIngredientPayload)
                        });
                    });
                    
                    return Promise.all(aIngredientPromises);
                }.bind(this))
                .then(function(aIngredientResults) {
                    // Close dialog
                    this._oCreateRecipeDialog.close();
                    
                    // Reload recipe list
                    this._loadRecipesFromAPI();
                    
                    // Navigate to new recipe's ObjectPage
                    var oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("objectPage", {
                        recipeId: oNewRecipe.recipeId
                    });
                    
                    var sSuccessMsg = "✅ Recipe '" + oNewRecipe.productName + "' created";
                    if (aIngredientResults && aIngredientResults.length > 0) {
                        sSuccessMsg += " with " + aIngredientResults.length + " ingredients!";
                    } else {
                        sSuccessMsg += " successfully!";
                    }
                    MessageToast.show(sSuccessMsg);
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ Failed to create recipe:", error);
                    var sErrorMsg = error.message || "Unknown error";
                    if (error.responseJSON && error.responseJSON.message) {
                        sErrorMsg = error.responseJSON.message;
                    }
                    MessageToast.show("❌ Failed to create recipe: " + sErrorMsg);
                }.bind(this));
        },

        onCancelCreateRecipe: function () {
            this._oCreateRecipeDialog.close();
        },

        onCopyRecipe: function () {
            var oModel = this.getView().getModel();
            var oSelectedRecipe = oModel.getProperty("/selectedRecipe");
            
            if (oSelectedRecipe) {
                MessageToast.show("Copy recipe: " + oSelectedRecipe.name);
            }
        },

        onDeleteRecipe: function () {
            var oModel = this.getView().getModel();
            var oSelectedRecipe = oModel.getProperty("/selectedRecipe");
            
            if (oSelectedRecipe) {
                MessageToast.show("Delete recipe: " + oSelectedRecipe.name);
                // Would show confirmation dialog
            }
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            var oTable = this.byId("recipesTable");
            var oBinding = oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            var aFilters = [];

            if (sQuery && sQuery.length > 0) {
                // Search across multiple fields
                var aSearchFilters = [
                    new Filter("name", FilterOperator.Contains, sQuery),
                    new Filter("id", FilterOperator.Contains, sQuery),
                    new Filter("primaryOutput", FilterOperator.Contains, sQuery),
                    new Filter("product", FilterOperator.Contains, sQuery)
                ];

                // Combine with OR logic
                aFilters.push(new Filter({
                    filters: aSearchFilters,
                    and: false
                }));
            }

            // Apply the filter
            oBinding.filter(aFilters);

            // Update count display
            var iCount = oBinding.getLength();
            if (sQuery) {
                MessageToast.show("Found " + iCount + " recipe(s)");
            }
        },

        _generateUniqueRecipeId: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            // Use pagination to get ALL Recipe IDs from NEW recipe collection
            return this._fetchAllRecords(sPocketbaseURL, "/api/collections/recipe/records?fields=field_id")
                .then(function(aAllItems) {
                    var aExistingIds = aAllItems.map(function(item) {
                        return item.field_id || "";
                    }).filter(function(id) {
                        return id.startsWith("REC");
                    });
                    
                    // Extract numeric suffixes and find max
                    var iMaxNumber = 0;
                    aExistingIds.forEach(function(sId) {
                        var sNumber = sId.replace("REC", "");
                        var iNumber = parseInt(sNumber, 10);
                        if (!isNaN(iNumber) && iNumber > iMaxNumber) {
                            iMaxNumber = iNumber;
                        }
                    });
                    
                    // Generate next ID
                    var iNextNumber = iMaxNumber + 1;
                    var sNewRecipeId = "REC" + String(iNextNumber).padStart(3, "0");
                    
                    return sNewRecipeId;
                })
                .catch(function(error) {
                    console.error("❌ Failed to fetch existing Recipe IDs:", error);
                    // Fallback to timestamp-based ID
                    var sFallbackId = "REC" + String(Date.now()).slice(-3);
                    return sFallbackId;
                });
        },

        _authenticateAdmin: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sAdminToken = oConfigModel.getProperty("/adminToken");
            
            // If we already have a token, return it
            if (sAdminToken) {
                return Promise.resolve(sAdminToken);
            }
            
            // Otherwise, login to get a new token
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            var sAdminEmail = oConfigModel.getProperty("/adminEmail");
            var sAdminPassword = oConfigModel.getProperty("/adminPassword");
            
            return new Promise(function(resolve, reject) {
                jQuery.ajax({
                    url: sPocketbaseURL + "/api/admins/auth-with-password",
                    method: "POST",
                    contentType: "application/json",
                    data: JSON.stringify({
                        identity: sAdminEmail,
                        password: sAdminPassword
                    }),
                    success: function(oData) {
                        var sToken = oData.token;
                        
                        // Store token in config
                        oConfigModel.setProperty("/adminToken", sToken);
                        
                        resolve(sToken);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error("❌ Admin authentication failed:", textStatus, errorThrown);
                        reject(new Error("Authentication failed: " + textStatus));
                    }
                });
            });
        }
    });
});
