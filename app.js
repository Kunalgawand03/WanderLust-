if(process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
console.log(process.env.SECRET);

const express = require('express');
const app = express();
const mongoose = require("mongoose");
const Listing = require('./Models/listing.js');
const path = require('path');
const methodOverride = require("method-override");
const ejsMate = require('ejs-mate');
const wrapAsync = require('./utils/wrapAsync.js');
const ExpressError = require('./utils/ExpressError.js');
const { listingSchema,reviewSchema } = require('./schema.js');
const Review = require('./Models/review.js');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./Models/user.js');
const { isLoggedIn } = require('./views/middleware.js'); // Importing the middleware
const { saveRedirectUrl } = require('./views/middleware.js'); // Importing the middleware
const { isOwner } = require('./views/middleware.js');
const { isReviewAuthor } = require('./views/middleware.js'); // Importing the middleware
const multer = require('multer');
const { storage } = require('./cloudConfig.js'); // Importing cloudinary configuration
const { type } = require('os');
const upload = multer({ storage }); // Set the destination for uploaded files

// const MONGO_URL ="mongodb://127.0.0.1:27017/wanderlust";

const dbUrl = process.env.ATLASDB_URL;

async function main(){
    await mongoose.connect(dbUrl);
}

main()
    .then(() => {
        console.log("Connected to MongoDB");
    })   

    .catch(err => {
        console.log(err);
    });
    
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "public")));

const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60, // time period in seconds
    crypto: {
        secret: process.env.SECRET,
    }
});

store.on("error", () => {
    console.log("SESSION STORE ERROR", e);
});

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave:false,
    saveUninitialized:true, 
    cookie:{
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
    }
};

// app.get("/", (req, res) => {
//     res.send("Hello World!");
// });


app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req, res, next) => {
    res.locals.success = req.flash("success"); 
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user; // Make currentUser available in all templates
    next();
});

// app.get("/demouser", async (req, res) => {
//     let fakeUser = new User({
//         username: "testuser",
//         email: "student@gmail.com",
//     });

// let registeredUser = await User.register(fakeUser, "testpassword");
//     res.send(registeredUser);
// });

const validateListing = (req, res, next) => {
    let result = listingSchema.validate(req.body);  
    if (result.error) {
        return next(new ExpressError(400, result.error.message));
    }
    next();
};

const validateReview = (req, res, next) => {
    let result = reviewSchema.validate(req.body);
    if (result.error) {
        return next(new ExpressError(400, result.error.message));
    }
    next();
};

app.get("/signup", (req, res) => {
    res.render("users/signup.ejs");
});

//signup route
app.post("/signup", async (req, res,) => {
    try {
        let { email, username, password } = req.body;
        let newUser = new User({ email, username });
        let registeredUser = await User.register(newUser, password);
        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }
             req.flash("success", "Welcome to Wanderlust!");
             res.redirect("/listings");
        });
       
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
});

//login route
app.get("/login", (req, res) => {
    res.render("users/login.ejs");
});

app.post("/login", saveRedirectUrl, passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
}), (req, res) => {
    req.flash("success", "Welcome Back!");
    let redirectUrl = res.locals.redirectUrl || "/listings"; // Use saved URL or default
    res.redirect(redirectUrl);  
});

//index route
// app.get("/listings", wrapAsync( async (req, res) => {
//     const allListings = await Listing.find({});
//     res.render("listings/index.ejs", { allListings });
// }));

app.get("/listings", wrapAsync(async (req, res) => {
  const { category } = req.query;
  let allListings;

  if (category) {
    allListings = await Listing.find({ category });
  } else {
    allListings = await Listing.find({});
    
  }
  

  res.render("listings/index.ejs", { allListings, category });
}));

//New Route
app.get("/listings/new", isLoggedIn,
    upload.single("listing[image]"),
      (req, res) => {
          res.render("listings/new.ejs");
    }); 

// app.get("/new", (req, res) => {
//     if (!req.isAuthenticated()) {
//         req.flash("error", "You must be logged in to create a listing!");
//         return res.redirect("/login");
//     }
//     res.render("listings/new.ejs");
// });

//Show Route
app.get("/listings/:id", wrapAsync( async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({path: 'reviews',
        populate: {
            path: 'author',
        },
  })
    .populate('owner');
    if (!listing) {
        req.flash("error", "Listing you requested for does Not Exist!");
        return res.redirect("/listings");
    }
    console.log(listing.owner);
  res.render("listings/show.ejs", { listing });
}));

//Create Route
// app.post("/listings", 
//     isLoggedIn,
//     upload.single("listing[image]"), 
//     validateListing,
//     wrapAsync( async (req, res,next) => {
//     // let url = req.file.path;
//     // let filename = req.file.filename;
//     // console.log(url,"..",filename);
//     let result = listingSchema.validate(req.body);
//     console.log(result);
//     if (result.error) {
//         return next(new ExpressError(400, result.error.message));
//     }

//     let url = req.file.path;
//     let filename = req.file.filename;
//      const newListing = new Listing(req.body.listing);
//      newListing.owner = req.user._id; // Set the owner to the current user
//      newListing.image = { url, filename } // Set the image URL from Cloudinary
//      if (req.file) {
//       newListing.image = req.file.path;
//     }
//      await newListing.save();
//      req.flash("success", "New Listing Created Successfully!");
//      res.redirect("/listings");
// }));

app.post("/listings", 
    isLoggedIn,
    upload.single("listing[image]"), 
    validateListing,
    wrapAsync( async (req, res, next) => {
    
    let result = listingSchema.validate(req.body);
    if (result.error) {
        return next(new ExpressError(400, result.error.message));
    }

    let url = req.file.path;
    let filename = req.file.filename;

    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;

    // CORRECT image assignment as object
    newListing.image = { url, filename };

    
    // if (req.file) {
    //   newListing.image = req.file.path;
    // }

    await newListing.save();
    req.flash("success", "New Listing Created Successfully!");
    res.redirect("/listings");
}));


//Edit Route
app.get("/listings/:id/edit", 
    isLoggedIn,
    isOwner, 
    wrapAsync( async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested for does Not Exist!");
        return res.redirect("/listings");
    }
  let originalImageUrl = listing.image.url; // Store the original image URL
  originalImageUrl = originalImageUrl.replace("/upload", '/upload/h_300,w_250'); // Adjust the URL to match the desired size
  res.render("listings/edit.ejs", { listing, originalImageUrl });
}));

//Update Route
app.put("/listings/:id",
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"), 
    validateListing,
    wrapAsync( async (req, res) => {
  let { id } = req.params;
//   let listing = await Listing.findById(id);
//   if (!listing.owner.equals(res.locals.currUser._id)) {
//     req.flash("error", "You do not have permission to edit this listing!");
//     return res.redirect(`/listings/${id}`);
//   }
  let listing= await Listing.findByIdAndUpdate(id, { ...req.body.listing });
  if(typeof req.file !== "undefined") { 
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = { url, filename }; // Update the image URL from Cloudinary
        await listing.save();
  }

  req.flash("success", "Listing Updated Successfully!");
  return res.redirect(`/listings/${id}`);
}));

//Delete Route
app.delete("/listings/:id",
    isLoggedIn,
    isOwner,
  isLoggedIn, wrapAsync( async (req, res) => {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success", "Listing Deleted!!");
  res.redirect("/listings");
}));

//Reviews
//Post Review Route
app.post("/listings/:id/reviews",isLoggedIn, validateReview, wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    const newReview = new Review(req.body.review);
    newReview.author = req.user._id; // Set the author to the current user
    listing.reviews.push(newReview._id);
    await newReview.save();
    await listing.save();
    req.flash("success", "New Review Created!");
    res.redirect(`/listings/${listing._id}`);
}));

//Delete Review Route
app.delete("/listings/:id/reviews/:reviewId",
    isLoggedIn,
    isReviewAuthor,
    wrapAsync(async (req, res) => {
    let { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    req.flash("success", "Review Deleted!");
    res.redirect(`/listings/${id}`);
}));

//Logout Route
app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "Logged out successfully!");
        res.redirect("/listings");
    }
    );
});

// app.post("/upload", upload.single("listing[image]"), (req, res) => {
//     console.log("Uploaded file:", req.file);
//     res.send(req.body);
// });


// app.get("/testListing", async (req, res) => {
//     let sampleListing = new Listing({
//         title: "My New Villa",
//         description: "By the Beach",
//         price: 1200,
//         location: "Calangute,Goa",
//         country: "India",
//     });

//     await sampleListing.save();
//     console.log("sample saved successfully");
//     res.send("sucessful testing");

// });

// app.all("*", (req, res,next) => {
//   next(new ExpressError(404,"Page Not Found"));
// });

app.use((err,req,res,next) => {
    let { statusCode=500,message="Something Went wrong" } = err;
    res.status(statusCode).render("error.ejs", {message});

    // res.status(statusCode).send(message);
});


app.listen(8080, () => {
    console.log("Server is running on port 8080");
});

// Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
