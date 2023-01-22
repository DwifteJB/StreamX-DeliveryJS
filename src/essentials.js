async function validateKey(mongoDB,key) {
    const purchases = mongoDB.db("purchases")
    const payments = purchases.collection("data")

    const user = await payments.findOne({"apikeys": {"key": key, "reason": undefined}});
    if (user) {
        return true
    }
}


module.exports = {validateKey}