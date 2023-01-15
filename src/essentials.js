const { MongoClient } = require("mongodb");

async function validateKey(mongoDB,key) {
    // app.payment = mongo["purchases"]
    const purchases = mongoDB.db("purchases")
    const payments = purchases.collection("data")

    const user = await payments.findOne({"apikeys": {"key": key, "reason": undefined}});
    if (user) {
        return true
    }
}


module.exports = {validateKey}