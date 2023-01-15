/*
    Streamx-DeliveryJS by DwifteJB
    Streamx-Delivery (python) by StreamX team
*/

/*
    const express = require("express")
    const app = express()

    app.get("/",(req,res) => {
        res.status(200)
        res.send("OK")
    })

    app.listen(80,() => {
        console.log("StreamX web server is online! localhost:80")
    })
*/
(async () => {
    const Crypto = require("crypto")
    const MongoConnector = require("./src/Mongo")
    const Essentials = require("./src/essentials")
    const CONFIG = require("./config.json")


    const express = require("express")
    const app = express()

    const bodyParser = require("body-parser");

    app.use(bodyParser.urlencoded({
        extended: true
    }));

    app.use(bodyParser.json());


    const Mongo = await new MongoConnector(CONFIG.MONGO.Username.trim(),CONFIG.MONGO.Password.trim(),CONFIG.MONGO.Address).init()
    const streamingDB = Mongo.db("streaming")
    const payments = Mongo.db("purchases")
    const paymentData = payments.collection("data")

    console.log(await Essentials.validateKey(Mongo,"sdaasd"))
    app.get("/",(req,res) => {
        res.status(200)
        res.send("OK")
    })

    app.post("/init",async (req,res) => {
        try {
            const apikey = await req.headers.get("X-StreamX-Key")
            if (!await Essentials.validateKey(Mongo,apikey)) {
                res.status(401)
                return res.send({"code": 401,"message": "Invalid auth key."})
            }

            const data = await req.json()
            const placeid = data.placeid
            const placever = data.placever

            const user = Mongo.db("payment").collection("data").findOne({whitelist:placeid,apikeys:{key: apikey, reason:undefined}})
            if (!user) {
                res.status(401)
                return res.send({"code": 401,"message": "You do not have access to this game."})
            }
            const dtime = Date.now()
            let dateObject = new Date(dtime)
            let time = `${dateObject.getUTCFullYear()}/${dateObject.getUTCMonth()}/${dateObject.getUTCDay()}`
            if (time != user["lastusage"]) {
                await paymentData.updateOne({"userid":user["userid"]},{"$set": {"quota": user["quota"] - 1}})
                await paymentData.updateOne({"userid":user["userid"]},{"$set": {"lastusage": time}})
            }

            const storagekey = `${placeid}${placever}`
            let authkey = await streamingDB.collection("keys").findOne({"storagekey":storagekey})
            let upload = false

            if (!authkey) {
                authkey = Crypto.randomBytes(16).toString("hex")
                upload = true
                await streamingDB.collection("keys").insertOne({"storagekey": storagekey, "authkey": authkey, "apikey": apikey})

            } else {
                if (apikey != authkey["apikey"]) {
                    res.status(401)
                    return res.send({"code": 401,"message": "API key is missing permissions for requested game."})
                } else if (parseInt(placever) == 0) {
                    await streamingDB.collection("parts").drop({dbName:storagekey})
                    await streamingDB.collection("keys").deleteOne({"authkey": authkey["authkey"]})
                    authkey = Crypto.randomBytes(16).toString("hex")
                    upload = true
                    await streamingDB.collection("keys").insertOne({"storagekey":storagekey,"authkey":authkey,"apikey":apikey})

                }  else {
                    authkey = authkey["authkey"]
                }
            }
            res.status(200)
            return res.send({"code": 200,"key": authkey,"upload": upload})
        
        } catch (e) {
            console.log(e)
            res.status(400)
            return res.send({"code": 400,"message":"Missing either PlaceID or Place Version."})
        
        }
    })

    app.post("/upload",async (req,res) => {
        const authkey = req.headers.get("X-StreamX-Auth")
        if (!authkey || authkey.length > 32) {
            res.status(401)
            return res.send({"code": 401,"message": "Invalid auth key."})
        }
        const kdata = streamingDB.collection("keys").findOne({"authkey":authkey})

        if (!kdata) {
            res.status(401)
            return res.send({"code": 401,"message": "Invalid auth key."})
        }

        try {
            let tb = []
            console.log(req.read())
        } catch (E) {
            console.log(E)
        }

    })

    app.listen(80,() => {
        console.log("StreamX web server is online! localhost:80")
    })
})()