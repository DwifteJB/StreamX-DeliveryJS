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

    // app.use(bodyParser.urlencoded({
    //     extended: true
    // }));

    const Mongo = await new MongoConnector(CONFIG.MONGO.Username.trim(),CONFIG.MONGO.Password.trim(),CONFIG.MONGO.Address).init()
    const streamingDB = await Mongo.db("streaming")
    const payments = await Mongo.db("purchases")

    console.log(await Essentials.validateKey(Mongo,"sdaasd"))
    app.get("/",(req,res) => {
        res.status(200).send("OK")
    })

    app.post("/init",bodyParser.urlencoded({
        extended: true
    }),bodyParser.json() ,async (req,res) => {
        try {
            const apikey = req.get("X-StreamX-Key")
            if (!await Essentials.validateKey(Mongo,apikey)) {
                console.log(apikey,"is an invalid auth key.")
                return res.status(401).json({"code": 401,"message": "Invalid auth key."})
            }

            const data = req.body
            console.log("data",data)
            const placeid = data.placeid
            const placever = data.placever

            const user = await Mongo.db("payment").collection("data").findOne({whitelist:placeid,apikeys:{key: apikey, reason:null}})
            if (!user) {
                console.log(apikey,"does not have access to game:",placeid)
                return res.status(401).json({"code": 401,"message": "You do not have access to this game."})
            }
            console.log("uhh")
            const dtime = Date.now()
            let dateObject = new Date(dtime)
            let time = `${dateObject.getUTCFullYear()}/${dateObject.getUTCMonth()}/${dateObject.getUTCDay()}`
            console.log(user)
            if (time != user["lastusage"]) {
                await payments.collection("data").updateOne({"userid":user["userid"]},{"$set": {"quota": user["quota"] - 1}})
                await payments.collection("data").updateOne({"userid":user["userid"]},{"$set": {"lastusage": time}})
            }
            console.log("uhh")

            const storagekey = `${placeid}${placever}`
            let authkey = await streamingDB.collection("keys").findOne({"storagekey":storagekey})
            let upload = false
            console.log("uhh")
            if (!authkey) {
                authkey = Crypto.randomBytes(16).toString("hex")
                upload = true
                await streamingDB.collection("keys").insertOne({"storagekey": storagekey, "authkey": authkey, "apikey": apikey})

            } else {
                if (apikey != authkey["apikey"]) {
                    return res.status(401).json({"code": 401,"message": "API key is missing permissions for requested game."})
                } else if (parseInt(placever) == 0) {
                    //await streamingDB.collection("parts").drop()
                    await streamingDB.collection("keys").deleteOne({"authkey": authkey["authkey"]})
                    authkey = Crypto.randomBytes(16).toString("hex")
                    upload = true
                    await streamingDB.collection("keys").insertOne({"storagekey":storagekey,"authkey":authkey,"apikey":apikey})

                }  else {
                    authkey = authkey["authkey"]
                }
            }
            console.log(apikey,"successfully uploaded to: ",placeid)
            return res.status(200).json({"code": 200,"key": authkey,"upload": upload})
        
        } catch (e) {
            console.log(e)
            return res.status(400).json({"code": 400,"message":"Missing either PlaceID or Place Version."})
        
        }
    })

    app.post("/upload",async (req,res) => {
        const authkey = req.get("X-StreamX-Auth")
        console.log("/upload:", authkey)
        if (!authkey || authkey.length > 32) {
            console.log(authkey,"was not found or was too long")
            return res.status(401).json({"code": 401,"message": "Invalid auth key."})
        }
        const kdata = await streamingDB.collection("keys").findOne({"authkey":authkey})

        if (!kdata) {
            console.log(authkey,"was invalid")
            return res.status(401).json({"code": 401,"message": "Invalid auth key."})
        }

        try {
            let tb = []
            let buffer = req.read()
            let bufferRead = Buffer.from(buffer).toString()
            console.log(buffer)
            console.log(bufferRead)
            for (let part in bufferRead.split(",")) {
                let partSplit = part.split(":")
                let x,y,z,d = partSplit
                tb.append({"x": float(x), "y": float(y), "z": float(z), "d": d})
                console.log("Appended:", partSplit,x,y,z,d)
            }
        } catch (E) {
            console.log(E)
        }

    })

    app.listen(80,() => {
        console.log("StreamX web server is online! localhost:80")
    })
})()