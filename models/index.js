require("dotenv").config();

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const DB = {};
DB.mongoose = mongoose;
DB.url = process.env.MONGO_URL;

DB.user = require("./User")(mongoose);
DB.blacklist = require("./Blacklist")(mongoose);
DB.product = require("./Product")(mongoose);
DB.category = require("./Category")(mongoose);
DB.cart = require("./Cart")(mongoose);
DB.order = require("./Order")(mongoose);

// chat
DB.message = require("./Message")(mongoose);

module.exports = DB;
