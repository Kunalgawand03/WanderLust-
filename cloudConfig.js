const cloudanary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudanary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudanary,
    params: {
        folder: 'wanderlust_DEV',
        allowed_formats: ['jpeg', 'png', 'jpg']
    }
});

module.exports = {
    cloudanary,
    storage,
};
