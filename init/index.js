const mongoose = require('mongoose');
const initdata = require('./data.js');
const Listing = require("../Models/listing.js");
const User = require("../Models/user.js");

const MONGO_URL ="mongodb://127.0.0.1:27017/wanderlust";

main()
    .then(() => {
        console.log("Connected to MongoDB");
    })   
    .catch(err => {
        console.log(err);
    });

async function main(){
    await mongoose.connect(MONGO_URL)
}

const initDB = async () => {
    await Listing.deleteMany({});
    initData.data = initData.data.map((obj) => ({
        ...obj,
        owner: "687478f42f73e5368eefce43", // Replace with actual user ID
    }));
    await Listing.insertMany(initData.data);
    console.log("Database initialized");
};

initDB();