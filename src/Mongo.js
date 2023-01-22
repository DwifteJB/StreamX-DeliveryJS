class MongoConnection {
    constructor(username,password,address) {
        this.username = username
        this.password = password
        this.address = address
    }
    async init() {
        const { MongoClient } = require("mongodb");

        const url = `mongodb+srv://${this.username.trim()}:${this.password.trim()}@${this.address}`
        const client = new MongoClient(url);
        try {
            await client.connect()
    
            await client.db("admin").command({ ping: 1 });
            console.log("Connected successfully to Mongo Instance.");


        } catch(err) {
            console.log("Could not connect to MongoDB!")
            console.log(err)
            process.exit(1)
        }
        this.Client = client
        return client  
    }
}

module.exports = MongoConnection
