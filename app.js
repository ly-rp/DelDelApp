// MODULE IMPORTS //
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path'); 

const app = express();

// STORAGE SETUP FOR MULTER //
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) =>{
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

// DATABASE CONNECTION //
const db = mysql.createConnection({
    host: 'oowidc.h.filess.io',
    user: 'Team34C237_gradecutgo',
    password: 'd26e4e85de269129b7c4eacb96801d1bcea66855',
    database: 'Team34C237_gradecutgo',
    port: 3307 
    // Information provided by Filess.io, Kaden is the owner of the database
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

// MIDDLEWARE SETUP //
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//SESSION MIDDLEWARE//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7}
}));

app.use(flash());


// SETTING UP EJS//
app.set('view engine', 'ejs');

//MIDDLEWARE TO CHECK IF USER IS LOGGED IN//
//****TO-DO: Include Authentication for Guest user.****//
const checkAuthenticated =(req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please login or enter as a guest to view this app!');
        res.redirect('/login');
    }
};

//******** TODO: Create a Middleware to check if user is admin. ********//
const checkAdmin =(req, res, next) => {
    if (req.session.user?.role==='admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
}

// WELCOME PAGE ROUTE (PUBLIC)//
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

app.get('/recipe/:id', (req, res) => {
    const studentId = req.params.id;
    const sql = 'SELECT * FROM Team34C237_gradecutgo.recipes WHERE recipeId = ?';
    db.query(sql, [studentId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving recipe by ID');
        }
        if (results.length > 0) {
            res.render('recipe', { recipe: results[0], user: req.session.user });
        } else {
            res.status(404).send('This recipe cannot found');
        }
    });
});

app.get('/recipe/:id', checkAuthenticated, (req, res) => {
  const recipeId = req.params.id;

  db.query('SELECT * FROM Team34C237_gradecutgo.recipes WHERE recipeId = ?', [recipeId], (error, results) => {
      if (error) throw error;
      if (results.length > 0) {
          res.render('recipe', { recipe: results[0], user: req.session.user });
      } else {
          res.status(404).send('recipe not found');
      }
  });
});


// ROUTE FOR GUEST ENTRY //
app.get('/guest', (req, res) => {
  req.session.user = { role: 'guest', username: 'Guest' };
  const sql = 'SELECT * FROM Team34C237_gradecutgo.recipes';
  db.query(sql, (error, results) => {
    if (error) return res.status(500).send('Error loading recipes');
    res.render('guest', { recipes: results, user: req.session.user });
  });
});



// ADDING RECIPE ROUTE //
app.get('/addRecipe', (req, res) => {
    res.render('addRecipe');
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
app.get('/editRecipe/:id', (req, res) => {
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

app.post('/editRecipe/:id',upload.single('image'), (req, res) => {
    const recipeId = req.params.id;
    const { recipeTitle, recipeDescription} = req.body;
    let image = req.body.currentImage; // retrieve current image filename
    if (req.file) { // if new image is uploaded
        image = req.file.filename; // set image to be new image filename
    } else if (!image) {
        image = 'noImage.png'; // Use noImage.png only if there is no current image
    }


    const sql = 'UPDATE recipe SET name = ?, image = ? WHERE recipeId = ?';

    //Inserting the new recipe into the database
    db.query( sql, [name, image, recipeId], (error, results) => {
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

//******** TODO: Create a middleware function validateRegistration ********//
// AUTH ROUTES (REGISTER/LOGIN/LOGOUT) //
const validateRegistration = (req, res,next) => {
    const {username, email, password, address, contact} = req.body; 

    if (!username ||!email || !password || !address || !contact) {
        return res.status(400).send('All fields are required.');
    }
    if (password.length<6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next(); 
};

app.get('/register', (req, res) => {
    res.render('register', {
        errors: req.flash('error'),
        messages: req.flash('success')
    });
});


//******** TODO: Integrate validateRegistration into the register route. ********//
app.post('/register', validateRegistration, (req, res) => {
    //******** TODO: Update register route to include role. ********//
    const { username, email, password, address, contact, role} = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

//******** TODO: Insert code for login routes to render login page below ********//
app.get('/login', (req, res) => {

    res.render('login', {
        messages: req.flash('success'), //Retrieve success messages from session
        errors: req.flash('error') //Retrieve error messages
    });
});

//******** TODO: Insert code for login routes for form submission below ********//
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


            //******** TODO: IUpdate to redirect users to /dashboard route upo successful log in : done?**//
            //Redirect based on user role//
            if (results[0].role === 'admin') {
                res.redirect('/admin');
            } else if (results[0].role === 'user') {
                res.redirect('/dashboard');
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

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/guest', (req, res) => {
  req.session.user = { role: 'guest' };

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


//******** TODO: Insert code for dashboard route to render dashboard page for users. ********//
// Updated to include Food Categories - Le Ying
app.get('/dashboard', checkAuthenticated, (req, res) => {
    const foodCategories = [
        { name: 'Desserts', image: '/images/categories/desserts.jpg' },
        { name: 'Soups', image: '/images/categories/soups.jpg' },
        { name: 'Breakfast', image: '/images/categories/breakfast.jpg' },
        { name: 'Salads', image: '/images/categories/salads.jpg' },
        { name: 'Side Dishes', image: '/images/categories/side_dishes.jpg' }
    ];
    res.render('dashboard', {user:req.session.user}); 
}); 

//******** TODO: Insert code for admin route to render dashboard page for admin. ********//
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', {user: req.session.user}); 
}); 

//******** TODO: Insert code for logout route ********//
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
})

//DASHBOARDS//
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});


// Starting the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`)); 
