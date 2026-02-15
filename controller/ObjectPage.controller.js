sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/f/library"
], function (Controller, JSONModel, MessageToast, fioriLibrary) {
    "use strict";

    return Controller.extend("fiori.ingredient.controller.ObjectPage", {
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("objectPage").attachPatternMatched(this._onObjectMatched, this);
            
            // Initialize model
            var oModel = new JSONModel({
                recipes: [],
                currentRecipe: null,
                comparisonIngredients: [],
                selectedIngredients: [],
                selectedCountryId: "",
                selectedCountryName: "",
                countries: [],
                // Ensure buttons can be enabled
                hasCountrySelected: false,
                hasIngredientsSelected: false,
                generatingLabel: false,
                generatedLabelUrl: "",
                labelData: null,
                availableLanguages: [],
                selectedTranslateLanguage: "",
                translating: false,
                translatedLabelUrl: "",
                translatedLanguage: "",
                documents: this._getMockDocuments(),
                availableIngredients: [],
                allIngredientsApproved: false,
                newRecipe: {
                    productName: "",
                    recipeId: "",
                    regionId: "",
                    selectedIngredientIds: [],
                    recipeType: "Standard"
                }
            });
            this.getView().setModel(oModel);
            
            // Load all recipes for the list
            this._loadAllRecipesFromAPI();
            
            // Load countries for dropdown
            this._loadCountriesFromAPI();
            
            // Load available languages for translation
            this._loadAvailableLanguages();
            
            // Load available ingredients for create dialog
            this._loadAvailableIngredients();
        },
        _loadAvailableIngredients: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            console.log("📡 Loading all ingredients from 'ingredients' collection...");
            
            jQuery.ajax({
                url: sPocketbaseURL + "/api/collections/ingredients/records",
                method: "GET",
                data: {
                    perPage: 500,
                    sort: "name"
                },
                success: function(oData) {
                    console.log("✅ Loaded " + oData.items.length + " ingredients");
                    var aMapped = oData.items.map(function(item) {
                        return {
                            id: item.id,
                            INGREDIENT_ID: item.field_id || item.id,
                            INGREDIENT_NAME: item.name || "Unknown",
                            name: item.name,
                            field_id: item.field_id
                        };
                    });
                    this.getView().getModel().setProperty("/availableIngredients", aMapped);
                }.bind(this),
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error("❌ Failed to load ingredients:", textStatus, errorThrown);
                }.bind(this)
            });
        },

        _onObjectMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            var sRecipeId = oArgs.recipeId;
            
            // Reset UI before loading new recipe
            this._resetLabelCreationUI();
            
            // Load the specific recipe from API
            this._loadRecipeByIdFromAPI(sRecipeId);
            
            // Show the flexible column layout in two columns mode
            var oFCL = this.byId("fcl");
            oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
        },

        _resetLabelCreationUI: function () {
            var oModel = this.getView().getModel();
            
            // Reset all label-related properties
            oModel.setProperty("/generatedLabelUrl", "");
            oModel.setProperty("/labelData", null);
            oModel.setProperty("/translatedLabelUrl", "");
            oModel.setProperty("/translatedLanguage", "");
            oModel.setProperty("/selectedTranslateLanguage", "");
            oModel.setProperty("/selectedCountryId", "");
            oModel.setProperty("/selectedCountryName", "");
            oModel.setProperty("/generatingLabel", false);
            oModel.setProperty("/translating", false);
            oModel.setProperty("/allIngredientsApproved", false);
            
            console.log("🧹 Label Creation UI reset for new recipe");
        },

        _loadAllRecipesFromAPI: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            console.log("📡 Loading all recipes from 'recipe' collection...");
            
            // Fetch all records using pagination from NEW recipe collection
            this._fetchAllRecords(sPocketbaseURL, "/api/collections/recipe/records")
                .then(function(aAllItems) {
                    console.log("✅ Loaded " + aAllItems.length + " total recipes from recipe collection");
                    
                    var aRecipes = aAllItems.map(function(item) {
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
                            ingredientIds: ""
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
                            
                            console.log("📄 Fetched page " + iPage + ": " + aItems.length + " records (Total: " + aAllRecords.length + ")");
                            
                            // Check if there are more pages
                            if (aItems.length === iPerPage) {
                                // There might be more records, fetch next page
                                iPage++;
                                fetchPage();
                            } else {
                                // Last page reached
                                console.log("✅ All pages fetched. Total records: " + aAllRecords.length);
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

        _loadRecipeByIdFromAPI: function (sRecipeId) {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            var sFilter = "field_id='" + sRecipeId + "'";
            
            console.log("📡 Loading recipe from 'recipe' collection, filter:", sFilter);
            
            jQuery.ajax({
                url: sPocketbaseURL + "/api/collections/recipe/records",
                method: "GET",
                data: {
                    filter: sFilter
                },
                success: function(oData) {
                    if (oData.items && oData.items.length > 0) {
                        var item = oData.items[0];
                        var oRecipe = {
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
                            notes: "",
                            pocketbaseId: item.id,
                            lifecycle: item.lifecycle || "",
                            ingredientIds: ""
                        };
                        
                        console.log("✅ Recipe loaded:", oRecipe.name);
                        this.getView().getModel().setProperty("/currentRecipe", oRecipe);
                        
                        // Load ingredients from recipeingredient linking table using PocketBase ID
                        this._loadRecipeIngredientsFromLinkingTable(item.id, oRecipe.name);
                        
                        this.getView().getModel().setProperty("/selectedIngredients", []);
                    } else {
                        MessageToast.show("Recipe not found");
                        console.log("⚠️ Recipe not found with filter:", sFilter);
                    }
                }.bind(this),
                error: function(jqXHR, textStatus, errorThrown) {
                    MessageToast.show("Error loading recipe: " + textStatus);
                    console.error("API Error:", errorThrown);
                }.bind(this)
            });
        },

        _loadRecipeIngredientsFromLinkingTable: function (sRecipeId, sProductName) {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            var sFilter = "recipe_fk='" + sRecipeId + "'";
            
            console.log("📡 Loading ingredients from 'recipeingredient' collection for recipe:", sRecipeId);
            
            jQuery.ajax({
                url: sPocketbaseURL + "/api/collections/recipeingredient/records",
                method: "GET",
                data: {
                    filter: sFilter,
                    perPage: 100
                },
                success: function(oData) {
                    if (oData.items && oData.items.length > 0) {
                        console.log("✅ Found " + oData.items.length + " ingredients for recipe");
                        
                        // Get ingredient details for each linked ingredient
                        this._resolveIngredientNames(oData.items, sProductName);
                    } else {
                        console.log("⚠️ No ingredients found for recipe:", sRecipeId);
                        this.getView().getModel().setProperty("/comparisonIngredients", []);
                    }
                }.bind(this),
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error("❌ Failed to load recipe ingredients:", textStatus, errorThrown);
                    this.getView().getModel().setProperty("/comparisonIngredients", []);
                }.bind(this)
            });
        },

        _resolveIngredientNames: function (aRecipeIngredients, sProductName) {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            var oModel = this.getView().getModel();
            
            console.log("🔍 Raw recipe ingredients received:", JSON.stringify(aRecipeIngredients, null, 2));
            
            // Check if ingredients have direct names (AI-generated) or need resolution (FK-based)
            // AI-generated will have ingredient_fk containing a name string (not an ID) and NO numeric ingredients
            var bHasDirectNames = aRecipeIngredients.length > 0 && aRecipeIngredients.every(function(item) {
                // Check if ingredient_fk looks like a name (contains spaces or lowercase) vs an ID (all caps/numbers)
                return item.ingredient_fk && item.originalingredient_fk;
            });
            
            console.log("📋 Has direct names:", bHasDirectNames);
            
            if (bHasDirectNames) {
                // AI-generated recipes with direct ingredient names stored in FK fields
                console.log("📋 Using direct ingredient names from AI generation");
                
                var aComparisonRows = aRecipeIngredients.map(function(item) {
                    var bIsAlternative = item.isalternative === 1 || item.isalternative === true;
                    var oRow = {
                        ingredientId: item.id,
                        currentIngredient: item.originalingredient_fk || item.ingredient_fk,
                        currentQty: item.quantity ? String(item.quantity) : "",
                        currentUnit: item.unit || "",
                        alternativeIngredient: bIsAlternative ? item.ingredient_fk : "-",
                        alternativeQty: bIsAlternative ? String(item.quantity) : "-",
                        alternativeUnit: bIsAlternative ? (item.unit || "") : "-",
                        status: bIsAlternative ? "Alternative Selected" : "Original",
                        statusState: bIsAlternative ? "Success" : "None",
                        productName: sProductName,
                        benefits: item.functionalrole || "",
                        cost: 0,
                        availability: ""
                    };
                    console.log("🔸 Mapped row:", oRow);
                    return oRow;
                });
                
                console.log("✅ Final comparison rows:", JSON.stringify(aComparisonRows, null, 2));
                oModel.setProperty("/comparisonIngredients", aComparisonRows);
                console.log("✅ Loaded " + aComparisonRows.length + " AI-generated ingredients");
                return;
            }
            
            // Legacy: Get all unique ingredient IDs for FK-based lookups
            var aIngredientIds = aRecipeIngredients.map(function(item) {
                return item.ingredient_fk;
            }).filter(Boolean);
            
            console.log("📡 Resolving " + aIngredientIds.length + " ingredient names from FKs...");
            
            // Fetch all ingredients at once for efficiency
            jQuery.ajax({
                url: sPocketbaseURL + "/api/collections/ingredients/records",
                method: "GET",
                data: {
                    perPage: 500
                },
                success: function(oData) {
                    // Create a lookup map: field_id -> ingredient
                    var oIngredientMap = {};
                    oData.items.forEach(function(ing) {
                        oIngredientMap[ing.field_id] = ing;
                    });
                    
                    // Build comparison rows
                    var aComparisonRows = aRecipeIngredients.map(function(item) {
                        var oIngredient = oIngredientMap[item.ingredient_fk] || {};
                        
                        return {
                            ingredientId: item.ingredient_fk || item.field_id,
                            currentIngredient: oIngredient.name || item.ingredient_fk,
                            currentQty: item.quantity || "",
                            currentUnit: item.unit || "",
                            alternativeIngredient: "-",
                            alternativeQty: "-",
                            alternativeUnit: "-",
                            status: "Not Started",
                            statusState: "None",
                            productName: sProductName,
                            cost: 0,
                            availability: "",
                            alternatives: [],
                            selectedAlternativeIndex: 0,
                            functionalRole: item.functionalrole || oIngredient.functional_role || ""
                        };
                    });
                    
                    console.log("✅ Built " + aComparisonRows.length + " comparison rows");
                    oModel.setProperty("/comparisonIngredients", aComparisonRows);
                }.bind(this),
                error: function(jqXHR, textStatus, errorThrown) {
                    console.error("❌ Failed to resolve ingredient names:", textStatus);
                    
                    // Fallback: use ingredient IDs as names
                    var aComparisonRows = aRecipeIngredients.map(function(item) {
                        return {
                            ingredientId: item.ingredient_fk,
                            currentIngredient: item.ingredient_fk,
                            currentQty: item.quantity || "",
                            currentUnit: item.unit || "",
                            alternativeIngredient: "-",
                            alternativeQty: "-",
                            alternativeUnit: "-",
                            status: "Not Started",
                            statusState: "None",
                            productName: sProductName,
                            cost: 0,
                            availability: "",
                            alternatives: [],
                            selectedAlternativeIndex: 0
                        };
                    });
                    
                    oModel.setProperty("/comparisonIngredients", aComparisonRows);
                }.bind(this)
            });
        },

        _loadRecipeIngredients: function (sIngredientIds, sProductName) {
            if (!sIngredientIds) {
                this.getView().getModel().setProperty("/comparisonIngredients", []);
                return;
            }

            // Parse ingredient IDs (pipe-separated)
            var aIngredientIds = sIngredientIds.split("|").map(function(id) {
                return id.trim();
            });

            // Fetch ingredient names from IngredientMasterData
            this._fetchIngredientNames(aIngredientIds, sProductName);
        },

        _fetchIngredientNames: function (aIngredientIds, sProductName) {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            var iProcessed = 0;
            var oIngredientMap = {};

            // Fetch name for each ingredient ID
            aIngredientIds.forEach(function(sId) {
                var sFilter = "INGREDIENT_ID='" + sId + "'";

                jQuery.ajax({
                    url: sPocketbaseURL + "/api/collections/IngredientMaster/records",
                    method: "GET",
                    data: {
                        filter: sFilter
                    },
                    success: function(oData) {
                        if (oData.items && oData.items.length > 0) {
                            oIngredientMap[sId] = {
                                name: oData.items[0].INGREDIENT_NAME || sId,
                                cost: oData.items[0].UNIT_COST_USD || 0,
                                availability: oData.items[0].AVAILABILITY || ""
                            };
                        } else {
                            // Fallback to ID if not found
                            oIngredientMap[sId] = {
                                name: sId,
                                cost: 0,
                                availability: ""
                            };
                        }
                        
                        iProcessed++;
                        if (iProcessed === aIngredientIds.length) {
                            this._createComparisonRows(aIngredientIds, oIngredientMap, sProductName);
                        }
                    }.bind(this),
                    error: function() {
                        // Fallback to ID on error
                        oIngredientMap[sId] = {
                            name: sId,
                            cost: 0,
                            availability: ""
                        };
                        iProcessed++;
                        if (iProcessed === aIngredientIds.length) {
                            this._createComparisonRows(aIngredientIds, oIngredientMap, sProductName);
                        }
                    }.bind(this)
                });
            }.bind(this));
        },

        _createComparisonRows: function (aIngredientIds, oIngredientMap, sProductName) {
            // Create comparison rows with actual ingredient names
            var aComparisonRows = aIngredientIds.map(function(sId) {
                var oIngredient = oIngredientMap[sId];
                return {
                    ingredientId: sId,
                    currentIngredient: oIngredient.name,
                    currentQty: "",
                    currentUnit: "",
                    alternativeIngredient: "-",  // Empty initially
                    alternativeQty: "-",
                    alternativeUnit: "-",
                    status: "Not Started",  // "Not Started" | "Pending Review" | "Replaced" | "Unchanged"
                    statusState: "None",  // "None" | "Warning" | "Success" | "None"
                    productName: sProductName,
                    cost: oIngredient.cost,
                    availability: oIngredient.availability,
                    alternatives: [],  // Will store fetched alternatives (max 3)
                    selectedAlternativeIndex: 0  // 0 = keep current, 1-3 = alternatives
                };
            });

            this.getView().getModel().setProperty("/comparisonIngredients", aComparisonRows);
        },

        _fetchSGDScoresForAlternatives: function (aAlternatives) {
            // Fetch SGD scores for alternative ingredients
            console.log("🎯 Fetching SGD scores for " + aAlternatives.length + " alternatives...");
            
            var aPromises = aAlternatives.map(function(oAlt) {
                return fetch('http://localhost:5001/score-ingredient', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ingredient: oAlt.name })
                })
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error("SGD API returned " + response.status);
                    }
                    return response.json();
                })
                .then(function(data) {
                    if (data.success) {
                        console.log("  ✅ " + oAlt.name + ": " + data.score_percentage + " (" + data.score_level + ")");
                        return {
                            name: oAlt.name,
                            reason: oAlt.reason,
                            regulationStatus: oAlt.regulationStatus || "",
                            regulationReference: oAlt.regulationReference || "",
                            sgdScore: data.score,
                            sgdScorePercentage: data.score_percentage,
                            sgdScoreLevel: data.score_level,
                            sgdScoreState: this._mapScoreLevelToState(data.score_level)
                        };
                    } else {
                        console.error("  ❌ " + oAlt.name + ": " + data.error);
                        return {
                            name: oAlt.name,
                            reason: oAlt.reason,
                            regulationStatus: oAlt.regulationStatus || "",
                            regulationReference: oAlt.regulationReference || "",
                            sgdScore: 0,
                            sgdScorePercentage: "N/A",
                            sgdScoreLevel: "Unknown",
                            sgdScoreState: "None"
                        };
                    }
                }.bind(this))
                .catch(function(error) {
                    console.error("  ❌ " + oAlt.name + ": " + error.message);
                    return {
                        name: oAlt.name,
                        reason: oAlt.reason,
                        regulationStatus: oAlt.regulationStatus || "",
                        regulationReference: oAlt.regulationReference || "",
                        sgdScore: 0,
                        sgdScorePercentage: "N/A",
                        sgdScoreLevel: "Unknown",
                        sgdScoreState: "None"
                    };
                }.bind(this));
            }.bind(this));
            
            return Promise.all(aPromises);
        },

        _mapScoreLevelToState: function (sScoreLevel) {
            // Map SGD score levels to SAP UI5 ObjectStatus states
            switch (sScoreLevel) {
                case "High":
                    return "Success";  // Green
                case "Medium":
                    return "Warning";  // Orange
                case "Low":
                case "Very Low":
                    return "Error";    // Red
                default:
                    return "None";     // Gray
            }
        },

        _setScoreError: function (sIngredientId) {
            var oModel = this.getView().getModel();
            var aCurrentRows = oModel.getProperty("/comparisonIngredients");
            var oTargetRow = aCurrentRows.find(function(row) {
                return row.ingredientId === sIngredientId;
            });
            
            if (oTargetRow) {
                oTargetRow.sgdScore = 0;
                oTargetRow.sgdScorePercentage = "N/A";
                oTargetRow.sgdScoreLevel = "Unknown";
                oTargetRow.sgdScoreState = "None";
                oModel.setProperty("/comparisonIngredients", aCurrentRows);
            }
        },

        onIngredientSelectionChange: function (oEvent) {
            var oTable = this.byId("ingredientsComparisonTable");
            var aSelectedItems = oTable.getSelectedItems();
            var aSelectedIngredients = aSelectedItems.map(function(oItem) {
                return oItem.getBindingContext().getObject();
            });

            this.getView().getModel().setProperty("/selectedIngredients", aSelectedIngredients);
        },

        onCountryChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oModel = this.getView().getModel();
            
            if (oSelectedItem) {
                var sCountryId = oSelectedItem.getKey();
                var sCountryName = oSelectedItem.getText();
                
                // Store selected country
                oModel.setProperty("/selectedCountryId", sCountryId);
                oModel.setProperty("/selectedCountryName", sCountryName);
                
                console.log("✅ Country selected:", sCountryName);
                MessageToast.show("Selected country: " + sCountryName);
            }
        },

        _loadCountriesFromAPI: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            console.log("📡 Loading countries from 'country' collection...");
            
            // Use pagination to fetch ALL countries from country collection
            this._fetchAllRecords(sPocketbaseURL, "/api/collections/country/records?sort=name")
                .then(function(aAllItems) {
                    console.log("✅ Loaded " + aAllItems.length + " countries from country collection");
                    
                    // Map country collection fields
                    var aCountries = aAllItems.map(function(item) {
                        return {
                            id: item.id,
                            name: item.name || "Unknown",
                            code: item.code || "",
                            fieldId: item.field_id || "",
                            regionFK: item.region_fk || ""
                        };
                    });
                    
                    this.getView().getModel().setProperty("/countries", aCountries);
                    console.log("✅ Countries loaded into dropdown");
                }.bind(this))
                .catch(function(error) {
                    MessageToast.show("Error loading countries: " + error.message);
                    console.error("API Error:", error);
                }.bind(this));
        },

        onFormulateAlternative: function () {
            var oModel = this.getView().getModel();
            var aSelectedIngredients = oModel.getProperty("/selectedIngredients");
            var sProductName = oModel.getProperty("/currentRecipe/name");
            var sSelectedCountry = oModel.getProperty("/selectedCountryName");

            if (aSelectedIngredients.length === 0) {
                MessageToast.show("⚠️ Please select ingredients to replace using the checkboxes");
                return;
            }

            console.log("🔄 Formulating alternatives for:", sProductName);
            console.log("📋 Selected ingredients:", aSelectedIngredients);
            
            // Log selected country
            if (sSelectedCountry) {
                console.log("🌍 Selected country:", sSelectedCountry);
                MessageToast.show("🔍 Fetching alternatives for " + aSelectedIngredients.length + " ingredient(s) (Country: " + sSelectedCountry + ")");
            } else {
                console.log("⚠️ No country selected");
                MessageToast.show("🔍 Fetching alternatives for " + aSelectedIngredients.length + " ingredient(s)...");
            }

            // Fetch alternatives for selected ingredients
            this._fetchAlternativesAndFormulate(aSelectedIngredients, sProductName);
        },

        onFormulateEntireRecipe: function () {
            var oModel = this.getView().getModel();
            var aAllIngredients = oModel.getProperty("/comparisonIngredients");
            var sProductName = oModel.getProperty("/currentRecipe/name");
            var sSelectedCountry = oModel.getProperty("/selectedCountryName");

            if (!aAllIngredients || aAllIngredients.length === 0) {
                MessageToast.show("⚠️ No ingredients found in this recipe");
                return;
            }

            console.log("🔄 Formulating ENTIRE recipe with ALL ingredients");
            console.log("📋 Total ingredients:", aAllIngredients.length);

            // Auto-select ALL ingredients
            var oTable = this.byId("ingredientsComparisonTable");
            oTable.selectAll();
            oModel.setProperty("/selectedIngredients", aAllIngredients);

            // Log selected country
            if (sSelectedCountry) {
                console.log("🌍 Selected country:", sSelectedCountry);
                MessageToast.show("🔍 Fetching alternatives for ENTIRE RECIPE - " + aAllIngredients.length + " ingredient(s) (Country: " + sSelectedCountry + ")");
            } else {
                console.log("⚠️ No country selected");
                MessageToast.show("🔍 Fetching alternatives for ENTIRE RECIPE - " + aAllIngredients.length + " ingredient(s)...");
            }

            // Fetch alternatives for ALL ingredients
            this._fetchAlternativesAndFormulate(aAllIngredients, sProductName);
        },

        _fetchAlternativesAndFormulate: function (aSelectedIngredients, sProductName) {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            var oModel = this.getView().getModel();
            var aComparisonRows = oModel.getProperty("/comparisonIngredients");
            var iProcessed = 0;
            var oAlternativesMap = {};

            console.log("🔍 Fetching up to 3 alternatives per ingredient");

            // Fetch alternatives for each selected ingredient
            aSelectedIngredients.forEach(function(oSelectedRow) {
                // Use double quotes in filter to handle apostrophes in names (e.g., "Knorr's", "Colman's")
                var sFilter = 'PRODUCT_NAME="' + sProductName + '" && ORIGINAL_INGREDIENT="' + oSelectedRow.currentIngredient + '"';
                console.log("📡 Fetching alternatives for:", oSelectedRow.currentIngredient);

                jQuery.ajax({
                    url: sPocketbaseURL + "/api/collections/AlternativeIngredients/records",
                    method: "GET",
                    data: {
                        filter: sFilter
                    },
                    success: function(oData) {
                        if (oData.items && oData.items.length > 0) {
                            // Parse alternatives (pipe-separated)
                            var sAlternatives = oData.items[0].ALTERNATIVE_INGREDIENTS || "";
                            var sReason = oData.items[0].REASON || "";
                            
                            var aAlternativesList = sAlternatives.split("|")
                                .map(function(alt) { return alt.trim(); })
                                .filter(function(alt) { return alt !== ""; })
                                .slice(0, 3);  // Max 3 alternatives
                            
                            if (aAlternativesList.length > 0) {
                                // Create alternatives array with reasons
                                var aAlternatives = aAlternativesList.map(function(alt, index) {
                                    return {
                                        name: alt,
                                        reason: sReason || this._generateReason(oSelectedRow, alt)
                                    };
                                }.bind(this));
                                
                                oAlternativesMap[oSelectedRow.ingredientId] = aAlternatives;
                                console.log("✨ Found " + aAlternatives.length + " alternative(s):", aAlternatives);
                            } else {
                                oAlternativesMap[oSelectedRow.ingredientId] = [];
                                console.log("⚠️ No alternatives found");
                            }
                        } else {
                            oAlternativesMap[oSelectedRow.ingredientId] = [];
                            console.log("❌ No data found");
                        }
                        
                        iProcessed++;
                        if (iProcessed === aSelectedIngredients.length) {
                            this._storeAlternativesAndSetPendingStatus(aComparisonRows, oAlternativesMap, aSelectedIngredients);
                        }
                    }.bind(this),
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error("❌ API Error:", textStatus, errorThrown);
                        oAlternativesMap[oSelectedRow.ingredientId] = [];
                        iProcessed++;
                        if (iProcessed === aSelectedIngredients.length) {
                            this._storeAlternativesAndSetPendingStatus(aComparisonRows, oAlternativesMap, aSelectedIngredients);
                        }
                    }.bind(this)
                });
            }.bind(this));
        },

        _generateReason: function(oOriginalIngredient, sAlternative) {
            // Generate a reason based on ingredient properties
            var aReasons = [];
            
            // Check cost difference
            if (oOriginalIngredient.cost > 5) {
                aReasons.push("Lower cost option");
            }
            
            // Check availability
            if (oOriginalIngredient.availability !== "In Stock") {
                aReasons.push("Better availability");
            }
            
            // Default reasons based on ingredient type
            if (sAlternative.toLowerCase().includes("oil")) {
                aReasons.push("Healthier fat profile");
            } else if (sAlternative.toLowerCase().includes("organic") || sAlternative.toLowerCase().includes("natural")) {
                aReasons.push("Natural alternative");
            } else {
                aReasons.push("Suitable substitute");
            }
            
            return aReasons.join(", ");
        },

        _storeAlternativesAndSetPendingStatus: function (aComparisonRows, oAlternativesMap, aSelectedIngredients) {
            var oModel = this.getView().getModel();
            var sSelectedCountry = oModel.getProperty("/selectedCountryName") || "US";
            
            console.log("🔄 Validating alternatives AND current ingredients with regulation API for country:", sSelectedCountry);
            
            // Collect all alternatives AND current ingredients for batch validation
            var aAllAlternatives = [];
            var aCurrentIngredients = [];
            var oIngredientToAlternativesMap = {};
            
            Object.keys(oAlternativesMap).forEach(function(ingredientId) {
                var aAlts = oAlternativesMap[ingredientId] || [];
                aAllAlternatives = aAllAlternatives.concat(aAlts);
                oIngredientToAlternativesMap[ingredientId] = aAlts;
                
                // Find the current ingredient for this ingredientId
                var oCurrentIngredient = aComparisonRows.find(function(row) {
                    return row.ingredientId === ingredientId;
                });
                
                if (oCurrentIngredient) {
                    aCurrentIngredients.push({
                        ingredientId: ingredientId,
                        name: oCurrentIngredient.currentIngredient
                    });
                }
            });
            
            // ALWAYS validate current ingredients first (even if no alternatives)
            var aCurrentIngredientNames = aCurrentIngredients.map(function(ing) {
                return ing.name;
            });
            
            console.log("🔍 Step 1: Validating current ingredients:", aCurrentIngredientNames);
            
            if (aCurrentIngredientNames.length === 0) {
                console.log("⚠️ No ingredients to validate");
                this._finalizeAlternativeStorage(aComparisonRows, oAlternativesMap, aSelectedIngredients, {}, {});
                return;
            }
            
            this._validateIngredientsWithRegulationAPI(aCurrentIngredientNames, sSelectedCountry)
                .then(function(oCurrentValidation) {
                    console.log("✅ Current ingredient validation complete");
                    
                    // Create map of current ingredient validation results
                    var oCurrentIngredientStatus = {};
                    aCurrentIngredients.forEach(function(ing, index) {
                        var validation = oCurrentValidation.validation_results[index];
                        oCurrentIngredientStatus[ing.ingredientId] = {
                            allowed: validation.allowed,
                            reason: validation.reason,
                            reference: validation.regulation_reference
                        };
                        
                        if (validation.allowed === false) {
                            console.log("  🚫 RESTRICTED: " + ing.name + " - " + validation.reason.substring(0, 100));
                        } else if (validation.allowed === true) {
                            console.log("  ✅ ALLOWED: " + ing.name);
                        } else {
                            console.log("  ❓ UNCLEAR: " + ing.name);
                        }
                    });
                    
                    // Check if we have alternatives to validate
                    if (aAllAlternatives.length === 0) {
                        console.log("⚠️ No alternatives to validate - using only current ingredient validation");
                        return {
                            alternatives: {
                                validated: [],
                                totalFetched: 0,
                                totalAllowed: 0,
                                totalRestricted: 0
                            },
                            currentIngredients: oCurrentIngredientStatus
                        };
                    }
                    
                    // Now validate alternatives
                    console.log("🔍 Step 2: Validating alternative ingredients");
                    return this._validateAlternativesWithRegulationAPI(aAllAlternatives, sSelectedCountry)
                        .then(function(oValidationResults) {
                            return {
                                alternatives: oValidationResults,
                                currentIngredients: oCurrentIngredientStatus
                            };
                        });
                }.bind(this))
                .then(function(oAllValidation) {
                    console.log("✅ Complete regulation validation done");
                    console.log("  Alternatives - Total:", oAllValidation.alternatives.totalFetched);
                    console.log("  Alternatives - Compliant:", oAllValidation.alternatives.totalAllowed);
                    console.log("  Alternatives - Restricted:", oAllValidation.alternatives.totalRestricted);
                    
                    // Create filtered alternatives map
                    var oFilteredAlternativesMap = {};
                    
                    Object.keys(oIngredientToAlternativesMap).forEach(function(ingredientId) {
                        var aIngredientAlts = oIngredientToAlternativesMap[ingredientId];
                        var aFinalFiltered = [];
                        
                        aIngredientAlts.forEach(function(alt) {
                            if (oAllValidation.alternatives.validated.some(function(v) { return v.name === alt.name; })) {
                                aFinalFiltered.push(alt);
                            }
                        });
                        
                        oFilteredAlternativesMap[ingredientId] = aFinalFiltered;
                    });
                    
                    // Store with filtered alternatives and current ingredient status
                    this._finalizeAlternativeStorage(aComparisonRows, oFilteredAlternativesMap, aSelectedIngredients, oAllValidation.alternatives, oAllValidation.currentIngredients);
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ Regulation validation failed:", error);
                    MessageToast.show("❌ Failed to validate alternatives: " + error.message + ". Please ensure regulation API is running.");
                }.bind(this));
        },

        _getCountryCode: function(sCountryName) {
            // Normalize country name (trim and uppercase for comparison)
            var sNormalized = (sCountryName || "").trim().toUpperCase();
            
            console.log("🔍 Country mapping: '" + sCountryName + "' → normalized: '" + sNormalized + "'");
            
            // Map country names to regulation API codes (case-insensitive)
            if (sNormalized === "UNITED STATES" || sNormalized === "USA" || sNormalized === "US") {
                console.log("  ✅ Mapped to: US");
                return "US";
            } else if (sNormalized === "INDIA") {
                console.log("  ✅ Mapped to: INDIA");
                return "INDIA";
            } else if (sNormalized === "CHINA" || sNormalized === "PEOPLE'S REPUBLIC OF CHINA" || sNormalized === "PRC") {
                console.log("  ✅ Mapped to: CHINA");
                return "CHINA";
            }
            
            // Default to US if not found
            console.log("  ⚠️  No mapping found, defaulting to: US");
            return "US";
        },

        _validateIngredientsWithRegulationAPI: function(aIngredientNames, sCountry) {
            // Convert country name to API code
            var sCountryCode = this._getCountryCode(sCountry);
            
            console.log("🔍 Validating " + aIngredientNames.length + " ingredients with regulation API...");
            console.log("🌍 Country: " + sCountry + " → API Code: " + sCountryCode);
            
            return fetch('http://localhost:5000/validate-ingredients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ingredients: aIngredientNames,
                    country: sCountryCode
                })
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Regulation API returned " + response.status);
                }
                return response.json();
            });
        },

        _validateAlternativesWithRegulationAPI: function(aAlternatives, sCountry) {
            var aIngredientNames = aAlternatives.map(function(alt) {
                return alt.name;
            });
            
            return this._validateIngredientsWithRegulationAPI(aIngredientNames, sCountry)
            .then(function(data) {
                console.log("✅ Regulation validation response received");
                
                // Filter alternatives - keep only allowed ones
                var aValidatedAlternatives = [];
                var iTotalRestricted = 0;
                
                aAlternatives.forEach(function(alt, index) {
                    var validation = data.validation_results[index];
                    if (validation.allowed === true) {
                        aValidatedAlternatives.push({
                            name: alt.name,
                            reason: alt.reason + " (✓ Regulation compliant)",
                            regulationStatus: "✓ Compliant",
                            regulationReference: validation.regulation_reference
                        });
                    } else {
                        iTotalRestricted++;
                        console.log("⚠️ Filtered out: " + alt.name + " (Restricted: " + validation.reason.substring(0, 100) + ")");
                    }
                });
                
                return {
                    validated: aValidatedAlternatives,
                    totalFetched: aAlternatives.length,
                    totalAllowed: aValidatedAlternatives.length,
                    totalRestricted: iTotalRestricted
                };
            });
        },

        _finalizeAlternativeStorage: function(aComparisonRows, oAlternativesMap, aSelectedIngredients, oValidationResults, oCurrentIngredientStatus) {
            var oModel = this.getView().getModel();
            var iUpdatedCount = 0;
            var iRestrictedCurrentCount = 0;

            console.log("🔄 Storing validated alternatives and current ingredient status");

            // Update rows: store alternatives, validation status, and set Pending Review
            var aUpdatedRows = aComparisonRows.map(function(oRow) {
                var aAlternatives = oAlternativesMap[oRow.ingredientId];
                
                // Check if this row was selected for formulation
                var bWasSelected = aSelectedIngredients.some(function(selected) {
                    return selected.ingredientId === oRow.ingredientId;
                });
                
                if (bWasSelected) {
                    iUpdatedCount++;
                    
                    // Get current ingredient validation status
                    var oCurrentStatus = oCurrentIngredientStatus ? oCurrentIngredientStatus[oRow.ingredientId] : null;
                    var bCurrentRestricted = oCurrentStatus && oCurrentStatus.allowed === false;
                    
                    if (bCurrentRestricted) {
                        iRestrictedCurrentCount++;
                        console.log("  🚫 Current ingredient RESTRICTED: " + oRow.currentIngredient);
                    }
                    
                    return {
                        ingredientId: oRow.ingredientId,
                        currentIngredient: oRow.currentIngredient,
                        currentQty: oRow.currentQty,
                        currentUnit: oRow.currentUnit,
                        alternativeIngredient: "-",
                        alternativeQty: "-",
                        alternativeUnit: "-",
                        status: "Pending Review",
                        statusState: "Warning",
                        productName: oRow.productName,
                        cost: oRow.cost,
                        availability: oRow.availability,
                        alternatives: aAlternatives || [],
                        selectedAlternativeIndex: 0,
                        currentIngredientRestricted: bCurrentRestricted,
                        currentIngredientReason: oCurrentStatus ? oCurrentStatus.reason : "",
                        currentIngredientReference: oCurrentStatus ? oCurrentStatus.reference : ""
                    };
                } else {
                    return oRow;
                }
            });

            // Update model
            oModel.setProperty("/comparisonIngredients", aUpdatedRows);

            // Clear selection
            var oTable = this.byId("ingredientsComparisonTable");
            oTable.removeSelections(true);
            oModel.setProperty("/selectedIngredients", []);

            // Show success message with regulation info
            var sMessage = "";
            if (oValidationResults && oValidationResults.totalFetched > 0) {
                sMessage = "✅ " + oValidationResults.totalAllowed + " compliant alternative(s) ready for review";
                if (oValidationResults.totalRestricted > 0) {
                    sMessage += " (" + oValidationResults.totalRestricted + " alternatives restricted)";
                }
                if (iRestrictedCurrentCount > 0) {
                    sMessage += " ⚠️ " + iRestrictedCurrentCount + " current ingredient(s) restricted!";
                }
            } else {
                var iTotalAlternatives = Object.values(oAlternativesMap).reduce(function(sum, alts) {
                    return sum + (alts ? alts.length : 0);
                }, 0);
                sMessage = "✅ Fetched " + iTotalAlternatives + " alternatives for " + iUpdatedCount + " ingredient(s)";
            }
            
            console.log(sMessage);
            MessageToast.show(sMessage);
        },


        _getMockDocuments: function () {
            return [
                {
                    name: "Certificates",
                    icon: "sap-icon://folder-blank",
                    iconColor: "#FFB900",
                    modifiedOn: "Mar 13, 2024",
                    createdBy: "write.tester@frm.sap.com",
                    modifiedBy: "write.tester@frm.sap.com",
                    size: ""
                },
                {
                    name: "Vegan.png",
                    icon: "sap-icon://document-text",
                    iconColor: "#0854A0",
                    modifiedOn: "Mar 29, 2024",
                    createdBy: "write.tester@frm.sap.com",
                    modifiedBy: "write.tester@frm.sap.com",
                    size: "292 KB"
                },
                {
                    name: "Lab Test Result.xlsx",
                    icon: "sap-icon://excel-attachment",
                    iconColor: "#107E3E",
                    modifiedOn: "Mar 29, 2024",
                    createdBy: "write.tester@frm.sap.com",
                    modifiedBy: "write.tester@frm.sap.com",
                    size: "8 KB"
                },
                {
                    name: "Product Fact Sheet Report.pdf",
                    icon: "sap-icon://pdf-attachment",
                    iconColor: "#E00000",
                    modifiedOn: "Mar 29, 2024",
                    createdBy: "write.tester@frm.sap.com",
                    modifiedBy: "write.tester@frm.sap.com",
                    size: "16 KB"
                }
            ];
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("listReport", {}, true);
        },

        onRecipeListSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            var oContext = oSelectedItem.getBindingContext();
            var oRecipe = oContext.getObject();
            
            // Reset UI before loading new recipe from side pane
            this._resetLabelCreationUI();
            
            this.getView().getModel().setProperty("/currentRecipe", oRecipe);
            
            // Load ingredients for this recipe
            this._loadRecipeIngredients(oRecipe.ingredientIds || "", oRecipe.name || "");
        },

        onRecipeItemPress: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext();
            var oRecipe = oContext.getObject();
            
            // Reset UI before loading new recipe from side pane
            this._resetLabelCreationUI();
            
            this.getView().getModel().setProperty("/currentRecipe", oRecipe);
            
            // Load ingredients for this recipe
            this._loadRecipeIngredients(oRecipe.ingredientIds || "", oRecipe.name || "");
        },

        onVersionPress: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext ? 
                oSource.getBindingContext() : 
                oSource.getParent().getBindingContext();
            
            if (oContext) {
                var oRecipe = oContext.getObject();
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("objectPage", {
                    recipeId: oRecipe.id
                });
            }
        },

        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            MessageToast.show("Switched to " + sKey + " tab");
        },

        onCloseDetail: function () {
            var oFCL = this.byId("fcl");
            oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);
        },

        onFullScreen: function () {
            var oFCL = this.byId("fcl");
            var sCurrentLayout = oFCL.getLayout();
            
            if (sCurrentLayout === fioriLibrary.LayoutType.MidColumnFullScreen) {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsMidExpanded);
            } else {
                oFCL.setLayout(fioriLibrary.LayoutType.MidColumnFullScreen);
            }
        },

        // Button handlers
        onCreateRecipe: function () {
            console.log("📝 Opening Create Recipe dialog");
            
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
                            console.log("✅ Create Recipe dialog opened with ID:", sNewRecipeId);
                        }.bind(this));
                    } else {
                        this._oCreateRecipeDialog.open();
                        console.log("✅ Create Recipe dialog opened with ID:", sNewRecipeId);
                    }
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ Failed to generate Recipe ID:", error);
                    MessageToast.show("⚠️ Failed to generate Recipe ID. Please try again.");
                });
        },

        onIngredientSelectionChangeInDialog: function (oEvent) {
            var oMultiComboBox = oEvent.getSource();
            var aSelectedKeys = oMultiComboBox.getSelectedKeys();
            
            console.log("✅ Selected " + aSelectedKeys.length + " ingredients");
            this.getView().getModel().setProperty("/newRecipe/selectedIngredientIds", aSelectedKeys);
        },

        onSaveNewRecipe: function () {
            var oModel = this.getView().getModel();
            var oNewRecipe = oModel.getProperty("/newRecipe");
            
            // Validate required fields
            if (!oNewRecipe.productName || oNewRecipe.productName.trim() === "") {
                MessageToast.show("⚠️ Please enter a product name");
                return;
            }
            
            if (!oNewRecipe.regionId || oNewRecipe.regionId === "") {
                MessageToast.show("⚠️ Please select a region");
                return;
            }
            
            if (!oNewRecipe.selectedIngredientIds || oNewRecipe.selectedIngredientIds.length === 0) {
                MessageToast.show("⚠️ Please select at least one ingredient");
                return;
            }
            
            console.log("💾 Saving new recipe:", oNewRecipe);
            
            // Find region name
            var aCountries = oModel.getProperty("/countries");
            var oRegion = aCountries.find(function(country) {
                return country.id === oNewRecipe.regionId;
            });
            var sRegionName = oRegion ? oRegion.name : oNewRecipe.regionId;
            
            // Prepare data for PocketBase
            var oPayload = {
                PRODUCT_NAME: oNewRecipe.productName.trim(),
                RECIPE_ID: oNewRecipe.recipeId,
                REGION: sRegionName,
                INGREDIENT_IDS: oNewRecipe.selectedIngredientIds.join("|")
            };
            
            console.log("📤 POST payload:", oPayload);
            MessageToast.show("💾 Creating recipe...");
            
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            // Authenticate first, then POST
            this._authenticateAdmin()
                .then(function(sToken) {
                    console.log("🔐 Authenticated, now POSTing with admin token");
                    
                    return jQuery.ajax({
                        url: sPocketbaseURL + "/api/collections/ProductIngredients/records",
                        method: "POST",
                        headers: {
                            "Authorization": sToken
                        },
                        contentType: "application/json",
                        data: JSON.stringify(oPayload)
                    });
                }.bind(this))
                .then(function(oData) {
                    console.log("✅ Recipe created successfully:", oData);
                    
                    // Close dialog
                    this._oCreateRecipeDialog.close();
                    
                    // Reload recipe list
                    this._loadAllRecipesFromAPI();
                    
                    // Navigate to new recipe
                    var oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("objectPage", {
                        recipeId: oNewRecipe.recipeId
                    });
                    
                    MessageToast.show("✅ Recipe '" + oNewRecipe.productName + "' created successfully!");
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ Failed to create recipe:", error);
                    MessageToast.show("❌ Failed to create recipe: " + error.message);
                }.bind(this));
        },

        onCancelCreateRecipe: function () {
            console.log("❌ Create recipe cancelled");
            this._oCreateRecipeDialog.close();
        },

        onCopyRecipe: function () {
            var oModel = this.getView().getModel();
            var oRecipe = oModel.getProperty("/currentRecipe");
            if (oRecipe) {
                MessageToast.show("Copy recipe: " + oRecipe.name);
            }
        },

        onDeleteRecipe: function () {
            var oModel = this.getView().getModel();
            var oRecipe = oModel.getProperty("/currentRecipe");
            if (oRecipe) {
                MessageToast.show("Delete recipe: " + oRecipe.name);
            }
        },

        onTransferToOutput: function () {
            MessageToast.show("Transfer to Primary Output");
        },

        onNewAlternative: function () {
            MessageToast.show("Create new alternative");
        },

        onNewVersion: function () {
            MessageToast.show("Create new version");
        },

        onCheckConsistency: function () {
            MessageToast.show("Checking consistency...");
        },

        // Document handlers
        onCreateDocument: function () {
            MessageToast.show("Create new document");
        },

        onEditLink: function () {
            MessageToast.show("Edit document link");
        },

        onDownloadDocument: function () {
            MessageToast.show("Download document");
        },

        onDeleteDocument: function () {
            MessageToast.show("Delete document");
        },

        onDocumentPress: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext();
            var oDocument = oContext.getObject();
            MessageToast.show("Open document: " + oDocument.name);
        },

        // Alternative Selection Handlers
        onIngredientRowPress: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext();
            var oIngredient = oContext.getObject();

            // Only allow selection if status is "Pending Review"
            if (oIngredient.status !== "Pending Review") {
                MessageToast.show("⚠️ Please click 'Formulate with Alternative' first to fetch alternatives");
                return;
            }

            console.log("📝 Opening alternative selection for:", oIngredient.currentIngredient);

            // If current ingredient is restricted, auto-select first alternative
            if (oIngredient.currentIngredientRestricted) {
                console.log("🚫 Current ingredient is RESTRICTED - auto-selecting first alternative");
                if (oIngredient.alternatives && oIngredient.alternatives.length > 0) {
                    oIngredient.selectedAlternativeIndex = 1; // Select first alternative
                    MessageToast.show("⚠️ Current ingredient is restricted - you must select an alternative");
                } else {
                    MessageToast.show("❌ Current ingredient is restricted but no alternatives available!");
                    return;
                }
            }

            var oModel = this.getView().getModel();
            
            // Check if alternatives have SGD scores already
            var bHasScores = oIngredient.alternatives.some(function(alt) {
                return alt.sgdScore !== undefined;
            });
            
            if (!bHasScores && oIngredient.alternatives.length > 0) {
                // Fetch SGD scores for alternatives before opening dialog
                console.log("🎯 Fetching SGD scores for alternatives...");
                MessageToast.show("🎯 Fetching SGD scores for alternatives...");
                
                this._fetchSGDScoresForAlternatives(oIngredient.alternatives)
                    .then(function(aScoredAlternatives) {
                        console.log("✅ SGD scores fetched, opening dialog");
                        
                        // Update the ingredient with scored alternatives
                        oIngredient.alternatives = aScoredAlternatives;
                        
                        // Update in the main model as well
                        var aComparisonRows = oModel.getProperty("/comparisonIngredients");
                        var oTargetRow = aComparisonRows.find(function(row) {
                            return row.ingredientId === oIngredient.ingredientId;
                        });
                        if (oTargetRow) {
                            oTargetRow.alternatives = aScoredAlternatives;
                            oModel.setProperty("/comparisonIngredients", aComparisonRows);
                        }
                        
                        // Set selected ingredient and open dialog
                        oModel.setProperty("/selectedIngredient", oIngredient);
                        this._openAlternativeDialog();
                    }.bind(this))
                    .catch(function(error) {
                        console.error("❌ Failed to fetch SGD scores:", error);
                        MessageToast.show("⚠️ Failed to fetch SGD scores, opening dialog anyway");
                        oModel.setProperty("/selectedIngredient", oIngredient);
                        this._openAlternativeDialog();
                    }.bind(this));
            } else {
                // Scores already fetched or no alternatives
                oModel.setProperty("/selectedIngredient", oIngredient);
                this._openAlternativeDialog();
            }
        },
        
        _openAlternativeDialog: function () {
            // Load and open the dialog
            if (!this._oAlternativeDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "fiori.ingredient.view.AlternativeSelectionPanel",
                    controller: this
                }).then(function(oDialog) {
                    this._oAlternativeDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oAlternativeDialog.open();
            }
        },

        formatAlternativeWithScore: function (sName, sScorePercentage) {
            // Formatter function to combine alternative name with SGD score and color indicator
            if (!sName) {
                return "";
            }
            if (!sScorePercentage || sScorePercentage === "N/A") {
                return sName + " - SGD Score: N/A";
            }
            
            // Extract numeric score from percentage string (e.g., "82.0%" -> 82.0)
            var fScore = parseFloat(sScorePercentage);
            var sIndicator = "";
            var sLevel = "";
            
            // Determine color indicator and level based on score
            if (fScore >= 80) {
                sIndicator = "🟢";  // Green circle
                sLevel = "High";
            } else if (fScore >= 60) {
                sIndicator = "🟠";  // Orange circle
                sLevel = "Medium";
            } else {
                sIndicator = "🔴";  // Red circle
                sLevel = "Low";
            }
            
            return sName + " - SGD Score: " + sIndicator + " " + sScorePercentage + " (" + sLevel + ")";
        },

        onApproveAlternativeSelection: function () {
            var oModel = this.getView().getModel();
            var oSelectedIngredient = oModel.getProperty("/selectedIngredient");
            var iSelectedIndex = oSelectedIngredient.selectedAlternativeIndex;

            console.log("✅ Approving selection, index:", iSelectedIndex);

            // Determine the choice
            var sAlternativeIngredient, sStatus, sStatusState;
            
            if (iSelectedIndex === 0) {
                // Keep current ingredient
                sAlternativeIngredient = oSelectedIngredient.currentIngredient;
                sStatus = "Unchanged";
                sStatusState = "None";
                console.log("✓ Keeping current ingredient");
            } else {
                // Select alternative (index 1-3 maps to alternatives[0-2])
                var iAltIndex = iSelectedIndex - 1;
                var oAlternative = oSelectedIngredient.alternatives[iAltIndex];
                sAlternativeIngredient = oAlternative.name;
                sStatus = "Replaced";
                sStatusState = "Success";
                console.log("✓ Selected alternative:", sAlternativeIngredient);
            }

            // Update the ingredient row in comparisonIngredients
            var aComparisonRows = oModel.getProperty("/comparisonIngredients");
            var aUpdatedRows = aComparisonRows.map(function(oRow) {
                if (oRow.ingredientId === oSelectedIngredient.ingredientId) {
                    return {
                        ingredientId: oRow.ingredientId,
                        currentIngredient: oRow.currentIngredient,
                        currentQty: oRow.currentQty,
                        currentUnit: oRow.currentUnit,
                        alternativeIngredient: sAlternativeIngredient,
                        alternativeQty: oRow.currentQty,  // Same quantity
                        alternativeUnit: oRow.currentUnit,  // Same unit
                        status: sStatus,
                        statusState: sStatusState,
                        productName: oRow.productName,
                        cost: oRow.cost,
                        availability: oRow.availability,
                        alternatives: oRow.alternatives,
                        selectedAlternativeIndex: iSelectedIndex
                    };
                } else {
                    return oRow;
                }
            });

            oModel.setProperty("/comparisonIngredients", aUpdatedRows);

            // Check if all ingredients are now approved
            this._checkIfAllIngredientsApproved();

            // Close dialog
            this._oAlternativeDialog.close();

            // Show success message
            MessageToast.show("✅ Selection approved: " + sAlternativeIngredient);
        },

        onCancelAlternativeSelection: function () {
            console.log("❌ Selection cancelled");
            this._oAlternativeDialog.close();
        },

        _checkIfAllIngredientsApproved: function () {
            var oModel = this.getView().getModel();
            var aIngredients = oModel.getProperty("/comparisonIngredients");
            
            if (!aIngredients || aIngredients.length === 0) {
                oModel.setProperty("/allIngredientsApproved", false);
                return;
            }
            
            // Check if ALL ingredients have been approved (status = "Replaced" or "Unchanged")
            var bAllApproved = aIngredients.every(function(item) {
                return item.status === "Replaced" || item.status === "Unchanged";
            });
            
            oModel.setProperty("/allIngredientsApproved", bAllApproved);
            
            if (bAllApproved) {
                console.log("✅ All ingredients approved! 'Add Recipe' button enabled");
                MessageToast.show("✅ All ingredients approved! You can now add this recipe.");
            } else {
                console.log("⏳ Some ingredients still pending review");
            }
        },

        _generateUniqueRecipeId: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            console.log("🔢 Generating unique Recipe ID from recipe collection...");
            
            // Use pagination to get ALL Recipe IDs from NEW recipe collection
            return this._fetchAllRecords(sPocketbaseURL, "/api/collections/recipe/records?fields=field_id")
                .then(function(aAllItems) {
                    var aExistingIds = aAllItems.map(function(item) {
                        return item.field_id || "";
                    }).filter(function(id) {
                        return id.startsWith("REC");
                    });
                    
                    console.log("📋 Found " + aExistingIds.length + " existing Recipe IDs in recipe collection");
                    
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
                    
                    console.log("✅ Generated unique Recipe ID:", sNewRecipeId);
                    return sNewRecipeId;
                })
                .catch(function(error) {
                    console.error("❌ Failed to fetch existing Recipe IDs:", error);
                    // Fallback to timestamp-based ID
                    var sFallbackId = "REC" + String(Date.now()).slice(-3);
                    console.log("⚠️ Using fallback Recipe ID:", sFallbackId);
                    return sFallbackId;
                });
        },

        _authenticateAdmin: function () {
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sAdminToken = oConfigModel.getProperty("/adminToken");
            
            // If we already have a token, return it
            if (sAdminToken) {
                console.log("✅ Using existing admin token");
                return Promise.resolve(sAdminToken);
            }
            
            // Otherwise, login to get a new token
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            var sAdminEmail = oConfigModel.getProperty("/adminEmail");
            var sAdminPassword = oConfigModel.getProperty("/adminPassword");
            
            console.log("🔐 Authenticating as admin...");
            
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
                        console.log("✅ Admin authentication successful");
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
        },

        onAddRecipeWithAlternatives: function () {
            var oModel = this.getView().getModel();
            var oCurrentRecipe = oModel.getProperty("/currentRecipe");
            var aIngredients = oModel.getProperty("/comparisonIngredients");
            var sSelectedCountry = oModel.getProperty("/selectedCountryName");
            
            console.log("➕ Adding new recipe with alternatives");
            console.log("📋 Original recipe:", oCurrentRecipe.name);
            console.log("🌍 New region:", sSelectedCountry);
            
            // Get approved ingredient IDs (use alternative if replaced, otherwise keep current)
            var aApprovedIngredientIds = aIngredients.map(function(item) {
                if (item.status === "Replaced") {
                    console.log("  🔄 Replaced:", item.currentIngredient, "→", item.alternativeIngredient);
                    return item.ingredientId;
                } else {
                    console.log("  ✓ Unchanged:", item.currentIngredient);
                    return item.ingredientId;
                }
            });
            
            MessageToast.show("💾 Adding recipe with alternatives...");
            
            var oConfigModel = this.getOwnerComponent().getModel("config");
            var sPocketbaseURL = oConfigModel.getProperty("/pocketbaseURL");
            
            // Generate unique Recipe ID first
            this._generateUniqueRecipeId()
                .then(function(sNewRecipeId) {
                    console.log("🔢 Using unique Recipe ID:", sNewRecipeId);
                    
                    // Prepare payload
                    var oPayload = {
                        PRODUCT_NAME: oCurrentRecipe.name,
                        RECIPE_ID: sNewRecipeId,
                        REGION: sSelectedCountry,
                        INGREDIENT_IDS: aApprovedIngredientIds.join("|")
                    };
                    
                    console.log("📤 POST payload:", oPayload);
                    
                    // Authenticate first, then POST
                    return this._authenticateAdmin()
                        .then(function(sToken) {
                            console.log("🔐 Authenticated, now POSTing with admin token");
                            
                            return jQuery.ajax({
                                url: sPocketbaseURL + "/api/collections/ProductIngredients/records",
                                method: "POST",
                                headers: {
                                    "Authorization": sToken
                                },
                                contentType: "application/json",
                                data: JSON.stringify(oPayload)
                            });
                        }.bind(this))
                        .then(function(oData) {
                            console.log("✅ Recipe added successfully:", oData);
                            
                            // Reload recipe list
                            this._loadAllRecipesFromAPI();
                            
                            // Navigate to new recipe
                            var oRouter = this.getOwnerComponent().getRouter();
                            oRouter.navTo("objectPage", {
                                recipeId: sNewRecipeId
                            });
                            
                            MessageToast.show("✅ Recipe added for " + sSelectedCountry + " region!");
                        }.bind(this));
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ Failed to add recipe:", error);
                    var sErrorMsg = error.message || "Unknown error";
                    if (error.responseJSON && error.responseJSON.message) {
                        sErrorMsg = error.responseJSON.message;
                    }
                    MessageToast.show("❌ Failed to add recipe: " + sErrorMsg);
                }.bind(this));
        },

        onGenerateLabel: function () {
            var oModel = this.getView().getModel();
            var oRecipe = oModel.getProperty("/currentRecipe");
            var aIngredients = oModel.getProperty("/comparisonIngredients");

            if (!oRecipe || !oRecipe.name) {
                MessageToast.show("⚠️ No recipe loaded");
                return;
            }

            console.log("🏷️ Generating AI-powered label for:", oRecipe.name);

            // Get ingredient names based on approval status
            var aIngredientNames = aIngredients.map(function(item) {
                // Use alternative if replaced, otherwise current
                if (item.status === "Replaced" && item.alternativeIngredient !== "-") {
                    return item.alternativeIngredient;
                } else {
                    return item.currentIngredient;
                }
            });

            if (aIngredientNames.length === 0) {
                MessageToast.show("⚠️ No ingredients found for this recipe");
                return;
            }

            // Show loading
            oModel.setProperty("/generatingLabel", true);
            oModel.setProperty("/generatedLabelUrl", "");
            oModel.setProperty("/labelData", null);
            oModel.setProperty("/translatedLabelUrl", "");
            oModel.setProperty("/translatedLanguage", "");
            oModel.setProperty("/selectedTranslateLanguage", "");

            // Prepare API request
            var oPayload = {
                product_name: oRecipe.name,
                ingredients: aIngredientNames,
                translate: false
            };

            console.log("📤 Sending to AI-powered label API:", oPayload);
            // MessageToast.show("🤖 Generating AI-powered label with nutrition analysis...");

            // Call beautify-label API (returns HUL-style beautified label)
            fetch("https://label-generator-api.cfapps.eu10-004.hana.ondemand.com/beautify-label", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(oPayload)
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("API returned status: " + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                console.log("✅ HUL-style beautified label generated:", data);
                
                if (data.success) {
                    // Store complete label data
                    oModel.setProperty("/labelData", data);
                    
                    // Set beautified image (already base64 data URL)
                    oModel.setProperty("/generatedLabelUrl", data.beautified_image);
                    
                    // Log AI analysis results
                    console.log("🎨 Beautified Label Generated:");
                    console.log("  🏷️  Style:", data.style);
                    console.log("  📋 Ingredients:", data.ingredients);
                    console.log("  ⚠️  Allergens:", data.allergens);
                    console.log("  🥗 Nutrition:", data.nutrition);
                    console.log("  💚 Health Score:", data.health_analysis.score);
                    console.log("  📢 Marketing:", data.marketing_tagline);
                    
                    MessageToast.show("✅ HUL-style beautified label generated!");
                } else {
                    throw new Error(data.error || "Unknown error");
                }
                
                oModel.setProperty("/generatingLabel", false);
            }.bind(this))
            .catch(function(error) {
                console.error("❌ Label generation failed:", error);
                oModel.setProperty("/generatingLabel", false);
                oModel.setProperty("/labelData", null);
                MessageToast.show("❌ Failed to generate label: " + error.message);
            }.bind(this));
        },

        _loadAvailableLanguages: function () {
            console.log("📡 Loading available languages from API...");
            
            fetch("https://label-generator-api.cfapps.eu10-004.hana.ondemand.com/languages")
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error("API returned status: " + response.status);
                    }
                    return response.json();
                })
                .then(function(data) {
                    console.log("✅ Loaded " + data.count + " languages:", data.supported_languages);
                    this.getView().getModel().setProperty("/availableLanguages", data.supported_languages);
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ Failed to load languages:", error);
                    // Fallback to basic list if API fails
                    this.getView().getModel().setProperty("/availableLanguages", [
                        "Hindi", "Spanish", "French", "German", "Chinese"
                    ]);
                }.bind(this));
        },

        onTranslateLabel: function () {
            var oModel = this.getView().getModel();
            var oRecipe = oModel.getProperty("/currentRecipe");
            var aIngredients = oModel.getProperty("/comparisonIngredients");
            var sSelectedLanguage = oModel.getProperty("/selectedTranslateLanguage");

            if (!sSelectedLanguage) {
                MessageToast.show("⚠️ Please select a language first");
                return;
            }

            console.log("🌍 Translating label to:", sSelectedLanguage);

            // Get ingredient names based on approval status (same logic as onGenerateLabel)
            var aIngredientNames = aIngredients.map(function(item) {
                // Use alternative if replaced, otherwise current
                if (item.status === "Replaced" && item.alternativeIngredient !== "-") {
                    return item.alternativeIngredient;
                } else {
                    return item.currentIngredient;
                }
            });

            // Show loading
            oModel.setProperty("/translating", true);
            oModel.setProperty("/translatedLabelUrl", "");

            // Prepare API request with translation
            var oPayload = {
                product_name: oRecipe.name,
                ingredients: aIngredientNames,
                translate: true,
                translate_languages: [sSelectedLanguage]
            };

            console.log("📤 Sending translation request:", oPayload);
            MessageToast.show("🌍 Translating beautified label to " + sSelectedLanguage + "...");

            // Call beautify-label API with translation (HUL-style beautified labels)
            fetch("https://label-generator-api.cfapps.eu10-004.hana.ondemand.com/beautify-label", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(oPayload)
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("API returned status: " + response.status);
                }
                
                // Check Content-Type to determine response format
                var sContentType = response.headers.get("content-type") || "";
                console.log("📋 Response Content-Type:", sContentType);
                
                if (sContentType.includes("application/json")) {
                    // JSON response (single language)
                    console.log("📄 Handling JSON response");
                    return response.json().then(function(data) {
                        return { type: "json", data: data };
                    });
                } else {
                    // ZIP response (multiple languages or fallback)
                    console.log("📦 Handling ZIP response");
                    return response.blob().then(function(blob) {
                        return { type: "zip", data: blob };
                    });
                }
            })
            .then(function(result) {
                if (result.type === "json") {
                    // Handle JSON response
                    this._handleJsonTranslation(result.data, sSelectedLanguage);
                } else {
                    // Handle ZIP response
                    this._extractTranslatedImage(result.data, sSelectedLanguage);
                }
            }.bind(this))
            .catch(function(error) {
                console.error("❌ Translation failed:", error);
                oModel.setProperty("/translating", false);
                MessageToast.show("❌ Failed to translate label: " + error.message);
            }.bind(this));
        },

        _handleJsonTranslation: function (data, sLanguage) {
            var oModel = this.getView().getModel();
            
            console.log("✅ JSON translation response received");
            
            // Handle both beautified_image and image properties for backward compatibility
            var sImageUrl = data.beautified_image || data.image;
            
            if (data.success && sImageUrl) {
                oModel.setProperty("/translatedLabelUrl", sImageUrl);
                oModel.setProperty("/translatedLanguage", sLanguage);
                oModel.setProperty("/translating", false);
                MessageToast.show("✅ Beautified label translated to " + sLanguage + "!");
                console.log("🎨 Translated beautified label displayed");
            } else {
                throw new Error(data.error || "Translation failed");
            }
        },

        _extractTranslatedImage: function (zipBlob, sLanguage) {
            var oModel = this.getView().getModel();
            var JSZip = window.JSZip;
            
            if (!JSZip) {
                console.error("❌ JSZip library not loaded");
                MessageToast.show("❌ ZIP extraction library not available");
                oModel.setProperty("/translating", false);
                return;
            }

            // Load and extract ZIP
            JSZip.loadAsync(zipBlob)
                .then(function(zip) {
                    console.log("📦 ZIP loaded, files:", Object.keys(zip.files));
                    
                    // Find the translated image (language name in lowercase)
                    var sLanguageLower = sLanguage.toLowerCase();
                    var sFileName = null;
                    
                    // Search for the file with language name
                    Object.keys(zip.files).forEach(function(fileName) {
                        if (fileName.includes(sLanguageLower) && fileName.endsWith('.png')) {
                            sFileName = fileName;
                        }
                    });
                    
                    if (!sFileName) {
                        throw new Error("Translated image not found in ZIP");
                    }
                    
                    console.log("📄 Found translated file:", sFileName);
                    
                    // Extract PNG as blob
                    return zip.files[sFileName].async("blob");
                })
                .then(function(pngBlob) {
                    console.log("✅ Translated PNG extracted, size:", pngBlob.size, "bytes");
                    
                    // Convert blob to data URL
                    var reader = new FileReader();
                    reader.onloadend = function() {
                        var dataUrl = reader.result;
                        oModel.setProperty("/translatedLabelUrl", dataUrl);
                        oModel.setProperty("/translatedLanguage", sLanguage);
                        oModel.setProperty("/translating", false);
                        MessageToast.show("✅ Label translated to " + sLanguage + "!");
                        console.log("🖼️ Translated label displayed");
                    }.bind(this);
                    reader.readAsDataURL(pngBlob);
                }.bind(this))
                .catch(function(error) {
                    console.error("❌ ZIP extraction failed:", error);
                    oModel.setProperty("/translating", false);
                    MessageToast.show("❌ Failed to extract translated label: " + error.message);
                }.bind(this));
        },

        onDownloadEnglishLabel: function () {
            var oModel = this.getView().getModel();
            var sImageUrl = oModel.getProperty("/generatedLabelUrl");
            var sProductName = oModel.getProperty("/currentRecipe/name") || "product";
            
            if (!sImageUrl) {
                MessageToast.show("⚠️ No English label available to download");
                return;
            }
            
            console.log("📥 Downloading English label...");
            
            // Generate filename
            var sFileName = sProductName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + "_label_english.png";
            
            // Download the image
            this._downloadImage(sImageUrl, sFileName);
        },

        onDownloadTranslatedLabel: function () {
            var oModel = this.getView().getModel();
            var sImageUrl = oModel.getProperty("/translatedLabelUrl");
            var sProductName = oModel.getProperty("/currentRecipe/name") || "product";
            var sLanguage = oModel.getProperty("/translatedLanguage") || "translated";
            
            if (!sImageUrl) {
                MessageToast.show("⚠️ No translated label available to download");
                return;
            }
            
            console.log("📥 Downloading translated label (" + sLanguage + ")...");
            
            // Generate filename
            var sLanguageLower = sLanguage.toLowerCase().replace(/[^a-z0-9]/gi, '_');
            var sFileName = sProductName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + "_label_" + sLanguageLower + ".png";
            
            // Download the image
            this._downloadImage(sImageUrl, sFileName);
        },

        _downloadImage: function (sDataUrl, sFileName) {
            try {
                // Create a temporary anchor element
                var link = document.createElement('a');
                link.href = sDataUrl;
                link.download = sFileName;
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log("✅ Download triggered:", sFileName);
                MessageToast.show("✅ Downloading " + sFileName);
            } catch (error) {
                console.error("❌ Download failed:", error);
                MessageToast.show("❌ Failed to download image: " + error.message);
            }
        }
    });
});
