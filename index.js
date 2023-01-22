/*
    Streamx-DeliveryJS by DwifteJB
    Streamx-Delivery (python) by StreamX team
*/

(async () => {
    const Crypto = require("crypto")
    const MongoConnector = require("./src/Mongo")
    const Essentials = require("./src/essentials")
    const CONFIG = require("./config.json")

    const express = require("express")
    const app = express()

    const bodyParser = require("body-parser");

    const Mongo = await new MongoConnector(CONFIG.MONGO.Username.trim(),CONFIG.MONGO.Password.trim(),CONFIG.MONGO.Address).init()
    const streamingDB = await Mongo.db("streaming")
    const payments = await Mongo.db("purchases")

    console.log(await Essentials.validateKey(Mongo,"sdaasd"))

    app.get("/",(req,res) => {
        res.status(200).send(`Welcome to the StreamX delivery server.<br><br> Sadly you can't do anything here until a webportal is built, except for: <a href="/dogwithabanana">clicking this link.</a><br><br>Get the StreamX Client <a href="https://github.com/Roblox-StreamX/Client">here</a><br><br>Support <a href="https://github.com/DwifteJB">Dwifte</a> and the <a href="https://github.com/Roblox-StreamX">StreamX Developers!</a>`)
    })

    app.post("/",(req,res) => {
        res.send(`OK`)
    })

    app.get("/dogwithabanana",(req,res) => {
        res.redirect("https://www.youtube.com/watch?v=21HNPnjjcZE")
    })

    app.post("/init",async (req,res) => { // bodyParser.urlencoded({extended: true}), bodyParser.json()
        try {
            const apikey = req.get("X-StreamX-Key")
            let placeid
            let placever
            try {
                placeid = parseInt(req.get("X-StreamX-PlaceID"))
                placever = parseInt(req.get("X-StreamX-PlaceVer"))
            } catch(e) {
                console.error(e)
                return res.status(401).json({"code": 401,"message": "Invalid headers."})
            }
            console.log(apikey,placeid,placever)
            if (placeid == undefined || placever == undefined) {
                console.log("Could not find headers.")
                return res.status(401).json({"code": 401,"message": "Invalid headers."})
            }

            if (!await Essentials.validateKey(Mongo,apikey)) {
                console.log(apikey,"is an invalid auth key.")
                return res.status(401).json({"code": 401,"message": "Invalid auth key."})
            }

            const user = await Mongo.db("payment").collection("data").findOne({whitelist:placeid,apikeys:{key: apikey, reason:null}})
            if (!user) {
                console.log(apikey,"does not have access to game:",placeid)
                return res.status(401).json({"code": 401,"message": "You do not have access to this game."})
            }
            const dtime = Date.now()
            let dateObject = new Date(dtime)
            let time = `${dateObject.getUTCFullYear()}/${dateObject.getMonth()+1}/${dateObject.getDay()}`
            console.log(user)
            if (time != user["lastusage"]) {
                await payments.collection("data").updateOne({"userid":user["userid"]},{"$set": {"quota": (user["quota"] || 5) - 1}})
                await payments.collection("data").updateOne({"userid":user["userid"]},{"$set": {"lastusage": time}})
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
                    return res.status(401).json({"code": 401,"message": "API key is missing permissions for requested game."})
                } else if (parseInt(placever) == 0) {
                    try {
                        await streamingDB.collection(`parts.${storagekey}`).drop()
                    } catch {}
                    await streamingDB.collection("keys").deleteOne({"authkey": authkey["authkey"]})
                    authkey = Crypto.randomBytes(16).toString("hex")
                    upload = true
                    await streamingDB.collection("keys").insertOne({"storagekey":storagekey,"authkey":authkey,"apikey":apikey})

                }  else {
                    authkey = authkey["authkey"]
                }
            }
            console.log(apikey,"successfully uploaded to:",placeid)
            return res.status(200).json({"code": 200,"key": authkey,"upload": upload})
        
        } catch (e) {
            console.log(e)
            return res.status(400).json({"code": 400,"message":"Missing either PlaceID or Place Version."})
        
        }
    })

    app.post("/upload", async (req,res) => {
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

            console.log(bufferRead)
            for (let part of bufferRead.split(",")) {
                let partSplit = part.split(":")
                console.log(part)
                console.log(partSplit)
                let x = partSplit[0]
                let y = partSplit[1]
                let z = partSplit[2]
                let d = partSplit[3]
                tb.push({"x": parseFloat(x), "y": parseFloat(y), "z": parseFloat(z), "d": d})
                console.log("Appended:",{"x": parseFloat(x), "y": parseFloat(y), "z": parseFloat(z), "d": d})
            }
            await streamingDB.collection(`parts.${kdata["storagekey"]}`).insertMany(tb)
            return res.status(200).json({"code": 200,"message": "OK"})
        } catch (E) {
            console.log(E)
            return res.status(400).json({"code": 400,"message": "Invalid part information."})
        }

    })
    app.post("/download",bodyParser.urlencoded({extended: true}), bodyParser.json(), async (req,res) => {
        const authkey = req.get("X-StreamX-Auth")
        console.log("/download:",authkey)
        if (authkey.length > 32) {
            console.log(authkey,"was not found or was too long")
            return res.status(401).json({"code": 401,"message": "Invalid auth key."})
        }

        const kdata = await streamingDB.collection("keys").findOne({"authkey": authkey})

        if (!kdata) {
            console.log(authkey,"is an invalid auth key")
            return res.status(401).json({"code": 401,"message": "Invalid auth key."})
        }

        try {
            const data = req.body
            console.log(data)
            const HeadPositions = data["HeadPosition"]
            const x = parseFloat(HeadPositions[0])
            const y = parseFloat(HeadPositions[1])
            const z = parseFloat(HeadPositions[2])
            const StudDifference = parseFloat(data["StudDifference"])

            const parts = await streamingDB.collection(`parts.${kdata["storagekey"]}`).find({
                "x": {$lt: x + StudDifference, $gt: x - StudDifference},
                "y": {$lt: y + StudDifference, $gt: y - StudDifference},
                "z": {$lt: z + StudDifference, $gt: z - StudDifference}
            }).toArray()
            console.log(parts)
            if (!parts || parts.length == 0) {
                res.send("!")
                return
            } else {
                let concat = []
                for (let p in parts) {
                    concat.push(parts[p]["d"])
                }
                
                let cc = concat.join(",")
                console.log(cc)
                return res.send(cc)
            }

        } catch(E) {
            console.log(E)
            return res.status(400).json({"code": 400,"message":"Missing either HeadPositions or StudDifference."})
        
        }
    })

    app.listen(80,() => {
        console.log("StreamX web server is online! localhost:80")
    })
})()