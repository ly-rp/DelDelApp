//*****MODULE IMPORTS*****//
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path'); 

const app = express();

//*****STORAGE SETUP FOR MULTER*****//
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) =>{
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

//*****DATABASE CONNECTION*****//
const db = mysql.createConnection({
    host: 'oowidc.h.filess.io',
    user: 'Team34C237_gradecutgo',
    password: 'd26e4e85de269129b7c4eacb96801d1bcea66855',
    database: 'Team34C237_gradecutgo',
    port: 3307 
    // Information provided by Filess.io, Kaden is the current owner of the database
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

//*****MIDDLEWARE SETUP*****//
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//*****SESSION MIDDLEWARE*****//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7}
}));

app.use(flash());


//*****SETTING UP EJS*****//
app.set('view engine', 'ejs');

//*****CHECK AUTHENTICATION/AUTHORISATION*****//
//AUNTHENTICATION FOR...?//
const checkAuthenticated =(req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please login or enter as a guest to view this app!');
        res.redirect('/login');
    }
};

//AUTHENTICATION FOR ADMIN//
const checkAdmin =(req, res, next) => {
    if (req.session.user?.role==='admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
}

//*****WELCOME PAGE (PUBLIC)*****//
app.get('/', (req, res) => {
    const sql = 'SELECT * FROM Team34C237_gradecutgo.recipes';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving recipe data');
        }
        res.render('welcome', { recipe: results, user: req.session.user });
    });
});

app.get('/recipes', (req, res) => {
  const sql = 'SELECT * FROM Team34C237_gradecutgo.recipes';

  db.query(sql, (error, results) => {
    if (error) {
      console.error("Database error:", error.message);
      return res.status(500).send('Error retrieving recipes');
    }

    const user = req.session.user || null;
    const isAdmin = user?.role === 'admin';
    const userId = user?.id || null;

    res.render('recipes', {
      recipes: results,
      user: req.session.user,
      isAdmin: isAdmin,
      userId: userId
    });
  });
});

//*****SINGLE RECIPE VIEW*****//
app.get('/recipe/:id', (req, res) => {
    const recipeId = req.params.id;

    db.query('SELECT * FROM Team34C237_gradecutgo.recipes WHERE recipeId = ?', [recipeId], (error, recipeResults) => {
        if (error) return res.status(500).send('Database error');
        if (recipeResults.length === 0) {
            return res.status(404).send('Recipe not found');
        }
        // Now get all reviews for this recipe
        db.query(
            'SELECT r.*, u.username FROM reviews r JOIN users u ON r.userId = u.id WHERE r.recipeId = ?',
            [recipeId],
            (err, reviewResults) => {
                if (err) return res.status(500).send('Database error');
                res.render('recipe', {
                    recipe: recipeResults[0],
                    reviews: reviewResults,
                    user: req.session.user,
                    isGuest: req.session.user?.role === 'guest',
                    isAdmin: req.session.user?.role === 'admin'
                });
            }
        );
    });
});

app.get('/review/:id', (req, res) => {
    const reviewId = req.params.id;

    db.query('SELECT * FROM Team34C237_gradecutgo.reviews WHERE reviewId = ?', [reviewId], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Server error');
        }

        if (results.length > 0) {
            res.render('review', { review: results[0], user: req.session.user });
        } else {
            res.status(404).send('Review not found');
        }
    });
});

app.post('/reviews/add', (req, res) => {
  const { recipeId, rating, comment } = req.body;
  const userId = req.session.user?.id;  // get logged-in user id

  if (!userId) {
    req.flash('error', 'You must be logged in to add a review.');
    return res.redirect('/login');
  }

  const sql = 'INSERT INTO reviews (recipeId, userId, rating, comment) VALUES (?, ?, ?, ?)';
  db.query(sql, [recipeId, userId, rating, comment], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).send('Error adding review');
    }
    res.redirect(`/recipe/${recipeId}`);
  });
});

//*****FAVOURITES ROUTES*****//
app.get('/favourites', (req, res) => {
    const query = `
        SELECT recipes.* FROM recipes
        JOIN favourites ON recipes.id = favourites.recipe_id
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching favourites:', err);
            return res.status(500).send('Database error');
        }
        res.render('favourites', { favourites: results });
    });
});

app.post('/favourites/add', (req, res) => {
    const recipeId = req.body.recipeId;

    db.query('INSERT INTO favourites (recipe_id) VALUES (?)', [recipeId], (err, result) => {
        if (err) {
            console.error('Error adding to favourites:', err);
            return res.status(500).send('Failed to add favourite');
        }
        res.redirect('/favourites');
    });
});


//*****CRUD OPERATIONS FOR RECIPES*****//
// ADDING RECIPE ROUTE //
app.get('/addRecipe', (req, res) => {
    res.render('addRecipe', { user: req.session.user });
});


app.post('/addRecipe',upload.single('image'), (req, res) => {
    const {recipeTitle, recipeDescription} = req.body;
    let image;
    if (req.file) {
        image = req.file.filename;
    } else {
        image = 'noImage.png'; // Use noImage.png if none uploaded
    }

    const sql = 'INSERT INTO Team34C237_gradecutgo.recipes (name, description, image) VALUES (?, ?, ?, ?)';
    db.query(sql , [recipeTitle, recipeDescription, image], (error, results) => { 
        if (error) {
            console.error("Error adding recipe:", error);
            res.status(500).send('Error adding recipe');
        } else {
            res.redirect('/');
        }
    });
});

// EDITING RECIPE ROUTE //
app.get('/editRecipe/:Id', (req, res) => {
    const recipeId = req.params.id;
    const sql = 'SELECT * FROM Team34C237_gradecutgo.recipes WHERE recipeId = ?';
    db.query(sql, [recipeId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving recipe for editing');
        }
        if (results.length > 0) {
            res.render('editRecipe', { recipe: results[0] });
        } else {
            res.status(404).send('This recipe cannot be found');
        }
    });
});

app.post('/editRecipe/:Id',upload.single('image'), (req, res) => {
    const recipeId = req.params.id;
    const { recipeTitle, recipeDescription} = req.body;
    let image = req.body.currentImage; // retrieve current image filename
    if (req.file) { // if new image is uploaded
        image = req.file.filename; // set image to be new image filename
    } else if (!image) {
        image = 'noImage.png'; // Use noImage.png only if there is no current image
    }

    const sql = 'UPDATE recipe SET recipeTitle = ?, recipeDescription = ?, image = ?, WHERE recipeId = ?';

    //Inserting the new recipe into the database
    db.query( sql, [recipeTitle, image, recipeDescription, recipeId], (error, results) => {
        if (error) {
            //Handle any error that occurs during the database operation
            console.error("Error updating recipe:", error);
            res.status(500).send('Error updating recipe');
        } else {
            //Send a success response
            res.redirect('/');
        }
    });
});

// DELETING RECIPE ROUTE //
app.get('/deleterecipe/:id', (req, res) => {
    const studentId = req.params.id;
    const sql = 'DELETE FROM Team34C237_gradecutgo.recipes WHERE recipeId = ?';
    db.query(sql, [recipeId], (error, results) => {
        if (error) {
            //Handle any error that occurs during the database operation
            console.error("Error deleting recipe:", error);
            res.status(500).send('Error deleting recipe');
        } else {
            res.redirect('/');
        }
    });
});

//*****AUTHENTICATION ROUTES*****//
// VALIDATING REGISTERATION //
const validateRegistration = (req, res, next) => {
    const { username, email, password, contact, role, adminPasskey } = req.body; // remove address, add role

    if (!username || !email || !password || !contact || !role) { // remove address, add role
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    if (role === 'admin' && adminPasskey !== 'D4LD4L@P') {
        req.flash('error', 'Invalid admin passkey.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

app.get('/register', (req, res) => {
    res.render('register', {
        user: req.session.user || null,
        errors: req.flash('error'),
        messages: req.flash('success')
    });
});

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, contact, role } = req.body; // remove address, add role
    const sql = 'INSERT INTO users (username, email, password, contact, role) VALUES (?, ?, SHA1(?), ?, ?)';
    db.query(sql, [username, email, password, contact, role], (err) => {
        if (err) {
            throw err;
        }
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

//VALIDATING LOGGING IN//
app.get('/login', (req, res) => {

    res.render('login', {
        user: req.session.user || null, //Pass user session to the view
        messages: req.flash('success'), //Retrieve success messages from session
        errors: req.flash('error') //Retrieve error messages
    });
});

app.post('/login', (req,res) => {
    const{email, password} =req.body;

    //Validate email and password
    if (!email || !password) { //Basically if email is empty, or if pw is empty
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password =SHA1(?)';
    db.query(sql, [email, password], (err, results)=>{
        if(err){
            throw err;
        }

        if(results.length > 0) {
            //Successful login 
            req.session.user =results[0]; //Store user in session
            req.flash('success', 'Login successful');

            //Redirect based on user role//
            if (results[0].role === 'admin') {
                res.redirect('/admin');
            } else if (results[0].role === 'user') {
                res.redirect('/user');
            } else {
                res.redirect('/'); // fallback, just in case
            }

        } else {
            //Invalid credentials
            req.flash('error', 'Invalid email or password');
            res.redirect('/login');
        }
    });
});

// LOGGING OUT //
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ROUTE FOR GUEST ENTRY //
app.get('/guest', (req, res) => {
  req.session.user = { role: 'guest', username: 'Guest' };

  const sql = 'SELECT * FROM Team34C237_gradecutgo.recipes';

  const foodCategories = [
    { name: 'Desserts', image: '/images/foodCategories/desserts.jpg' },
    { name: 'Soups', image: '/images/foodCategories/soups.jpg' },
    { name: 'Breakfast', image: '/images/foodCategories/breakfast.jpg' },
    { name: 'Salads', image: '/images/foodCategories/salads.jpg' },
    { name: 'Side Dishes', image: '/images/foodCategories/side_dishes.jpg' }
  ];

  db.query(sql, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).send('Error loading recipes');
    }

    res.render('guest', {
      recipes: results,
      categories: foodCategories,
      user: req.session.user
    });
  });
});


//*****DASHBOARDS*****//
// Updated to include Food Categories - Le Ying
app.get('/dashboard', checkAuthenticated, (req, res) => {
    const categories = [
    { name: 'Desserts', image: '/images/categories/desserts.jpg' },
    { name: 'Soups', image: '/images/categories/soups.jpg' },
    { name: 'Breakfast', image: '/images/categories/breakfast.jpg' },
    { name: 'Salads', image: '/images/categories/salads.jpg' },
    { name: 'Side Dishes', image: '/images/categories/side_dishes.jpg' }
];
res.render('dashboard', { user: req.session.user, categories });

}); 

app.get('/dashboard', (req, res) => {
  const user = req.session.user;

  // Fetch categories (assuming you have a categories table)
  db.query('SELECT * FROM categories', (err, results) => {
    if (err) throw err;

    res.render('dashboard', {
      user: user,
      categories: results // <<== this is what you were missing
    });
  });
});


//ADMIN DASHBOARD//
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
  const sql = 'SELECT * FROM Team34C237_gradecutgo.recipes';
  db.query(sql, (error, results) => {
    if (error) {
      console.error('Database error:', error.message);
      return res.status(500).send('Error retrieving recipes for admin');
    }

    res.render('admin', {
      user: req.session.user,
      recipes: results 
    });
  });
});



app.get('/user', checkAuthenticated, (req, res) => {
  const foodCategories = [
    { name: 'Desserts', image: '/images/foodCategories/desserts.jpg' },
    { name: 'Soups', image: '/images/foodCategories/soups.jpg' },
    { name: 'Breakfast', image: '/images/foodCategories/breakfast.jpg' },
    { name: 'Salads', image: '/images/foodCategories/salads.jpg' },
    { name: 'Side Dishes', image: '/images/foodCategories/side_dishes.jpg' }
  ];

  const sql = 'SELECT * FROM Team34C237_gradecutgo.recipes';

  db.query(sql, (err, recipes) => {
    if (err) {
      console.error('Error fetching recipes:', err);
      return res.status(500).send('Internal Server Error');
    }

    res.render('user', { user: req.session.user, recipes, categories: foodCategories });
  });
});


//RATINGS AND COMMENTS ROUTES //
app.get('/reviews', (req, res) => {
  res.render('reviews', { user: req.session.user });
});

// *****FOOD CATEGORIES AND THEIR LISTS***** //
// DISPLAYING ALL RECIPES, THE MAIN LIST //
app.get('/recipesList', (req, res) => {
  const sql = 'SELECT * FROM Team34C237_gradecutgo.recipes';

  db.query(sql, (error, results) => {
    if (error) {
      console.error("Database error:", error.message);
      return res.status(500).send('Error retrieving recipes');
    }

    res.render('recipesList', {
      recipes: results,
      user: req.session.user
    });
  });
});

// DISPLAYING GOOD SOUP LIST //
app.get('/soupsList', (req, res) => {
  const query = 'SELECT * FROM recipes WHERE category = "Soups"';
  db.query(query, (err, results) => {
    if (err) throw err;
    res.render('soupsList', {
      recipes: results,
      user: req.session.user
    });
  });
});


//*****STARTING THE SERVER*****//
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`This server is running on 'http://localhost:${PORT}'`)); 
