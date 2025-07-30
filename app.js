//*****MODULE IMPORTS*****//
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path'); 
const app = express();
//guys don't change the order of these imports, it will break the app -ELe 

//*****STORAGE SETUP FOR MULTER*****//
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/recipeImages');
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
  const userId = req.session.user ? req.session.user.id : 0;

  const sql = `
    SELECT r.recipeId, r.recipeTitle, r.recipeImage, r.creatorId,
           CASE WHEN f.recipeId IS NOT NULL THEN 1 ELSE 0 END AS isFavourited
    FROM Team34C237_gradecutgo.recipes r
    LEFT JOIN favourites f 
      ON r.recipeId = f.recipeId AND f.userId = ?
  `;

  db.query(sql, [userId], (error, results) => {
    if (error) {
      console.error("Database error:", error.message);
      return res.status(500).send('Error retrieving recipes');
    }

    const user = req.session.user || null;

    res.render('recipes', {
      recipes: results,
      user: user,
      isAdmin: user?.role === 'admin',
      userId: user?.id || null
    });
  });
});


//*****SINGLE RECIPE VIEW*****//
app.get('/recipe/:id', (req, res) => {
    const recipeId = req.params.id;
    const userId = req.session.user?.id || null;

    // 1️⃣ Get recipe details
    db.query('SELECT * FROM Team34C237_gradecutgo.recipes WHERE recipeId = ?', [recipeId], (error, recipeResults) => {
        if (error) return res.status(500).send('Database error');
        if (recipeResults.length === 0) return res.status(404).send('Recipe not found');

        let recipe = recipeResults[0];

        // 2️⃣ Get reviews
        db.query(
            'SELECT r.*, u.username FROM reviews r JOIN users u ON r.userId = u.id WHERE r.recipeId = ?',
            [recipeId],
            (err, reviewResults) => {
                if (err) return res.status(500).send('Database error');

                // 3️⃣ If user logged in, check if favourited
                if (userId) {
                    db.query(
                        'SELECT 1 FROM favourites WHERE userId = ? AND recipeId = ?',
                        [userId, recipeId],
                        (favErr, favResult) => {
                            recipe.isFavourited = !favErr && favResult.length > 0;
                            res.render('recipe', { recipe, reviews: reviewResults, user: req.session.user });
                        }
                    );
                } else {
                    // Guest user → No favourite status
                    recipe.isFavourited = false;
                    res.render('recipe', { recipe, reviews: reviewResults, user: req.session.user });
                }
            }
        );
    });
});


//****REVIEW****//
app.get('/review/:id', (req, res) => {
  const recipeId = req.params.id;

  // Step 1: Query to get the recipe title (to show on the review page)
  const recipeSql = 'SELECT recipeTitle FROM recipes WHERE recipeId = ?';
  db.query(recipeSql, [recipeId], (err1, recipeResults) => {

    // If recipe not found or there's an error, return 404
    if (err1 || recipeResults.length === 0) {
      return res.status(404).send('Recipe not found');
    }
    // Extract the title of the recipe
    const recipeTitle = recipeResults[0].recipeTitle;
    // Step 2: Query to get all reviews for that recipe (joined with usernames)
    const reviewSql = `
      SELECT r.*, u.username
      FROM reviews r
      JOIN users u ON r.userId = u.id
      WHERE r.recipeId = ?
      ORDER BY r.created_at DESC
    `;
    db.query(reviewSql, [recipeId], (err2, reviews) => {
      // If query fails, send a 500 Internal Server Error
      if (err2) {
        return res.status(500).send('Error fetching reviews');
      }
      // Step 3: Render the review.ejs page with necessary data
      res.render('review', {
        recipeId,           // Pass recipe ID to the view
        recipeTitle,        // Recipe name for the page header
        review: null,       // Optional: used if showing a single review (currently unused)
        reviews,            // All reviews for that recipe
        user: req.session.user  // Logged-in user info (used for permissions like delete)
      });
    });
  });
});


// Route: Handle POST request to add a new review
app.post('/reviews/add', (req, res) => {
  const { recipeId, rating, comment } = req.body;
  // Get the currently logged-in user's ID from session (if available)
  const userId = req.session.user?.id;

  // If user is not logged in, redirect to login page with flash message
  if (!userId) {
    req.flash('error', 'You must be logged in to add a review.');
    return res.redirect('/login');
  }
  // SQL query to insert new review into the database
  const sql = 'INSERT INTO reviews (recipeId, userId, rating, comment) VALUES (?, ?, ?, ?)';
  db.query(sql, [recipeId, userId, rating, comment], (error, results) => {
    if (error) {
      console.error(error);  
      return res.status(500).send('Error adding review');  // Send error response
    }
    res.redirect(`/recipe/${recipeId}`);
  });
});


// Handle delete review request
app.post('/reviews/delete/:reviewId', (req, res) => {
  const reviewId = req.params.reviewId;
  // First, get the recipeId for redirect
  db.query('SELECT recipeId FROM reviews WHERE reviewId = ?', [reviewId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(500).send('Database error or review not found');
    }
    const recipeId = results[0].recipeId;
    db.query('DELETE FROM reviews WHERE reviewId = ?', [reviewId], (err2) => {
      if (err2) {
        return res.status(500).send('Database error');
      }
      res.redirect('/recipe/' + recipeId);
    });
  });
});


//*****FAVOURITES ROUTES*****//
app.get('/favourites', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id; // use session-based user
    const sql = `
      SELECT r.recipeId, r.recipeTitle, r.recipeImage
      FROM favourites f
      JOIN recipes r ON f.recipeId = r.recipeId
      WHERE f.userId = ?;
    `;

    const message = req.session.message;
    req.session.message = null; // clear after showing

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send("Error retrieving favourites");
        }
        res.render('favourites', { recipes: results, user: req.session.user });
    });
});

// Add to favourites
app.post('/favourites/add/:recipeId', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const recipeId = req.params.recipeId;

    const checkSql = "SELECT * FROM favourites WHERE userId = ? AND recipeId = ?";
    db.query(checkSql, [userId, recipeId], (err, rows) => {
        if (err) {
            console.error("Error checking favourite:", err);
            req.session.message = "Error adding favourite.";
            return res.redirect('/favourites');
        }

        if (rows.length > 0) {
            req.session.message = "Recipe is already in your favourites!";
            return res.redirect('/favourites');
        }

        const insertSql = "INSERT INTO favourites (userId, recipeId) VALUES (?, ?)";
        db.query(insertSql, [userId, recipeId], (err) => {
            if (err) {
                console.error("Error adding favourite:", err);
                req.session.message = "Error adding favourite.";
                return res.redirect('/favourites');
            }
            req.session.message = "Recipe added to favourites!";
            res.redirect('/favourites');
        });
    });
});

// Remove from favourites
app.post('/favourites/remove/:recipeId', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const recipeId = req.params.recipeId;

    const sql = "DELETE FROM favourites WHERE userId = ? AND recipeId = ?";
    db.query(sql, [userId, recipeId], (err) => {
        if (err) {
            console.error("Error removing favourite:", err);
            return res.status(500).send("Error removing favourite");
        }
        req.session.message = "Recipe removed from favourites!";
        res.redirect('/favourites');
    });
});

app.get('/addRecipe', (req, res) => {
  res.render('addRecipe', { user: req.session.user });
});

app.post('/addRecipe', upload.single('recipeImage'), (req, res) => {
  const { recipeTitle, category, recipeDescription, ingredients, instructions, prep_time, cook_time, servings, favourite } = req.body;
  const user = req.session.user;
  const userId = user?.id;

  if (!userId) return res.status(401).send('Please login to add a recipe');

  let image = req.file ? req.file.filename : 'noImage.png';

  const sql = `
    INSERT INTO Team34C237_gradecutgo.recipes 
    (recipeTitle, category, recipeDescription, ingredients, instructions, recipeImage, prep_time, cook_time, servings, creatorId) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [recipeTitle, category, recipeDescription, ingredients, instructions, image, prep_time, cook_time, servings, userId], (error, results) => {
    if (error) {
      console.error("Error adding recipe:", error);
      return res.status(500).send('Error adding recipe');
    }

    const newRecipeId = results.insertId;

    // If user checked favourite and role is 'user', add favourite
    if (user.role === 'user' && favourite === 'on') {
      const favSql = 'INSERT INTO favourites (userId, recipeId) VALUES (?, ?)';
      db.query(favSql, [userId, newRecipeId], (favError) => {
        if (favError) {
          console.error("Error adding favourite:", favError);
          // Ignore fav error, still redirect
        }
        return res.redirect(`/recipe/${newRecipeId}`);
      });
    } else {
      return res.redirect(`/recipe/${newRecipeId}`);
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
            res.render('editRecipe', { recipe: results[0], user: req.session.user });
        } else {
            res.status(404).send('This recipe cannot be found');
        }
    });
});

app.post('/editRecipe/:recipeId',upload.single('image'), (req, res) => {
    const recipeId = req.params.id || req.body.recipeId; // Use recipeId from params or body}
    const { recipeTitle, category, recipeDescription, ingredients, instructions, prep_time, cook_time, servings} = req.body;
    let image = req.body.currentImage; // retrieve current image filename
    if (req.file) { // if new image is uploaded
        image = req.file.filename; // set image to be new image filename
    } else if (!image) {
        image = 'noImage.png'; // Use noImage.png only if there is no current image
    }

    const sql = 'UPDATE Team34C237_gradecutgo.recipes SET recipeTitle = ?, category = ?, recipeDescription = ?, ingredients = ?, instructions = ?, prep_time = ?, cook_time = ?, servings = ?, recipeImage = ? WHERE recipeId = ?';

    //Inserting the new recipe into the database
    db.query( sql, [recipeTitle, category, recipeDescription, ingredients, instructions, prep_time, cook_time, servings, image, recipeId], (error, results) => {
        if (error) {
            //Handle any error that occurs during the database operation
            console.error("Error updating recipe:", error);
            res.status(500).send('Error updating recipe');
        } else {
            // Redirect after successful update - send user back to recipe page or dashboard
            res.redirect(`/recipe/${recipeId}`);
        }
    });
});

// DELETING RECIPE ROUTE //
app.post('/delete/:recipeId', (req, res) => {
    const recipeId = req.params.recipeId;
    const user = req.session.user;

    if (!user) return res.redirect('/login');

    // Allow only admin or owner
    const sql = `
        DELETE FROM recipes 
        WHERE recipeId = ? AND (creatorId = ? OR ? = 'admin')
    `;
    db.query(sql, [recipeId, user.id, user.role], (err) => {
        if (err) {
            console.error("Error deleting recipe:", err);
            return res.status(500).send("Error deleting recipe");
        }
        res.redirect('/recipes');
    });
});

// DELETING RECIPE ROUTE //
app.get('/deleteRecipe/:id', (req, res) => {
    const recipeId = req.params.id;
    const user = req.session.user;

    const sql = 'DELETE FROM Team34C237_gradecutgo.recipes WHERE recipeId = ?';
    db.query(sql, [recipeId], (error, results) => {
        if (error) {
            console.error("Error deleting recipe:", error);
            return res.status(500).send('Error deleting recipe');
        }

        // Redirect based on user role
        if (user?.role === 'admin') {
            res.redirect('/admin');
        } else if (user?.role === 'user') {
            res.redirect('/user');
        } else {
            // fallback to home or login if guest or no user
            res.redirect('/');
        }
    });
});

// Show My Recipes
app.get('/myRecipes', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    const sql = `
        SELECT r.*,
               CASE WHEN f.recipeId IS NOT NULL THEN 1 ELSE 0 END AS isFavourited
        FROM recipes r
        LEFT JOIN favourites f ON r.recipeId = f.recipeId AND f.userId = ?
        WHERE r.creatorId = ?`;

    db.query(sql, [userId, userId], (err, results) => {
        if (err) {
            console.error('Error fetching user recipes:', err);
            return res.status(500).send('Server error while retrieving your recipes');
        }

        res.render('myRecipes', {
            user: req.session.user,
            recipes: results
        });
    });
});

// Delete a recipe (only if the creator matches)
app.post('/myRecipes/delete/:id', checkAuthenticated, (req, res) => {
    const recipeId = req.params.id;
    const userId = req.session.user.id;

    const sql = 'DELETE FROM recipes WHERE recipeId = ? AND creatorId = ?';
    db.query(sql, [recipeId, userId], (err, result) => {
        if (err) {
            console.error('Error deleting recipe:', err);
            return res.status(500).send('Server error while deleting recipe');
        }

        if (result.affectedRows === 0) {
            return res.status(403).send('You are not allowed to delete this recipe');
        }

        res.redirect('/myRecipes');
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

// REGISTER ROUTE //
app.get('/register', (req, res) => {
    res.render('register', {
        user: req.session.user || null,
        errors: req.flash('error'),
        messages: req.flash('success')
    });
});

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, contact, role } = req.body;

    const passwordErrors = [];

    // Password validation
    if (password.length < 6) {
        passwordErrors.push("Password must be at least 6 characters.");
    }
    if (!/[A-Z]/.test(password)) {
        passwordErrors.push("Password must contain at least one uppercase letter.");
    }
    if (!/\d/.test(password)) {
        passwordErrors.push("Password must contain at least one number.");
    }

    if (passwordErrors.length > 0) {
        req.flash('error', passwordErrors);
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    const checkEmailSql = 'SELECT * FROM users WHERE email = ?';
    db.query(checkEmailSql, [email], (err, results) => {
        if (err) {
            console.error("Error checking email:", err);
            req.flash('error', 'Server error.');
            return res.redirect('/register');
        }

        if (results.length > 0) {
            req.flash('error', 'This email is already registered.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        // If email doesn't exist, proceed to insert
        const insertSql = 'INSERT INTO users (username, email, password, contact, role) VALUES (?, ?, SHA1(?), ?, ?)';
        db.query(insertSql, [username, email, password, contact, role], (err) => {
            if (err) {
                console.error("Error inserting user:", err);
                req.flash('error', 'Registration failed. Please try again.');
                return res.redirect('/register');
            }

            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        });
    });
});


// VALIDATING LOGGING IN //
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

// FORGOT PASSWORD //
app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', {
    user: req.session.user || null,
    errors: req.flash('error'),
    messages: req.flash('success'),
  });
});

// Handle forgot password form submission with security question verification
app.post('/forgot-password', (req, res) => {
  const { email, newPassword, securityQ1, securityQ2, securityQ3 } = req.body;

  // Check required fields
  if (!email || !newPassword || !securityQ1 || !securityQ2 || !securityQ3) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/forgot-password');
  }

  // Password basic check
  if (newPassword.length < 6 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
    req.flash('error', 'Password must be at least 6 characters, include an uppercase letter and a number.');
    return res.redirect('/forgot-password');
  }

  // Check if user with email exists
  const findUserSql = 'SELECT * FROM users WHERE email = ?';
  db.query(findUserSql, [email], (err, results) => {
    if (err) {
      console.error('Database error while checking email:', err);
      req.flash('error', 'Server error.');
      return res.redirect('/forgot-password');
    }

    if (results.length === 0) {
      req.flash('error', 'No user found with that email.');
      return res.redirect('/forgot-password');
    }

    const user = results[0];

    // Check if all 3 security answers match (case-insensitive comparison)
    const matchQ1 = user.securityQ1.toLowerCase() === securityQ1.trim().toLowerCase();
    const matchQ2 = user.securityQ2.toLowerCase() === securityQ2.trim().toLowerCase();
    const matchQ3 = user.securityQ3.toLowerCase() === securityQ3.trim().toLowerCase();

    if (!matchQ1 || !matchQ2 || !matchQ3) {
      req.flash('error', 'Security question answers do not match.');
      return res.redirect('/forgot-password');
    }

    // All good, update password (SHA1 hash)
    const updatePasswordSql = 'UPDATE users SET password = SHA1(?) WHERE email = ?';
    db.query(updatePasswordSql, [newPassword, email], (err) => {
      if (err) {
        console.error('Error updating password:', err);
        req.flash('error', 'Could not update password.');
        return res.redirect('/forgot-password');
      }

      req.flash('success', 'Password reset successful! You may now login.');
      res.redirect('/login');
    });
  });
});

// LOGGING OUT //
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/home', (req, res) => {
  const userId = req.session.user ? req.session.user.id : 0;

  const foodCategories = [
    { name: 'Desserts', image: '/images/foodCategories/desserts.jpg' },
    { name: 'Soups', image: '/images/foodCategories/soups.jpg' },
    { name: 'Breakfast', image: '/images/foodCategories/breakfast.jpg' },
    { name: 'Salads', image: '/images/foodCategories/salads.jpg' },
    { name: 'Side Dishes', image: '/images/foodCategories/side_dishes.jpg' }
  ];

  const sql = `
    SELECT r.recipeId, r.recipeTitle, r.recipeImage, r.creatorId,
           CASE WHEN f.recipeId IS NOT NULL THEN 1 ELSE 0 END AS isFavourited
    FROM Team34C237_gradecutgo.recipes r
    LEFT JOIN favourites f 
      ON r.recipeId = f.recipeId AND f.userId = ?
  `;

  db.query(sql, [userId], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).send('Error loading recipes');
    }

    res.render('home', {
      recipes: results,
      categories: foodCategories,
      user: req.session.user
    });
  });
});

// RATINGS AND COMMENTS ROUTES //
app.get('/reviews', (req, res) => {
  res.render('reviews', { user: req.session.user });
});

// *****FOOD CATEGORIES AND THEIR LISTS***** //
//There ought to be five categories by the end of this - Ele

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


// DISPLAYING SOUP LIST //
app.get('/soupsList', (req, res) => {
  const user = req.session.user;

  const query = `SELECT r.*, 
    EXISTS (
      SELECT 1 FROM favourites f WHERE f.recipeId = r.recipeId AND f.userId = ?
    ) AS isFavourited 
    FROM recipes r WHERE r.category = 'Soups'`;

  db.query(query, [user?.id || 0], (err, results) => {
    if (err) throw err;
    res.render('soupsList', { recipes: results, user });
  });
});


// DISPLAYING DESSERTS LIST //
app.get('/dessertsList', (req, res) => {
  const user = req.session.user;

  const query = `SELECT r.*, 
    EXISTS (
      SELECT 1 FROM favourites f WHERE f.recipeId = r.recipeId AND f.userId = ?
    ) AS isFavourited 
    FROM recipes r WHERE r.category = 'Desserts'`;

  db.query(query, [user?.id || 0], (err, results) => {
    if (err) throw err;
    res.render('sdessertsList', { recipes: results, user });
  });
});

// DISPLAYING SIDE DISHES LIST //
app.get('/sidedishesList', (req, res) => {
  const user = req.session.user;

  const query = `SELECT r.*, 
    EXISTS (
      SELECT 1 FROM favourites f WHERE f.recipeId = r.recipeId AND f.userId = ?
    ) AS isFavourited 
    FROM recipes r WHERE r.category = 'Side Dishes'`;

  db.query(query, [user?.id || 0], (err, results) => {
    if (err) throw err;
    res.render('sidedishesList', { recipes: results, user });
  });
});


// DISPLAYING BREAKFAST LIST //
app.get('/breakfastList', (req, res) => {
  const user = req.session.user;

  const query = `SELECT r.*, 
    EXISTS (
      SELECT 1 FROM favourites f WHERE f.recipeId = r.recipeId AND f.userId = ?
    ) AS isFavourited 
    FROM recipes r WHERE r.category = 'Breakfast'`;

  db.query(query, [user?.id || 0], (err, results) => {
    if (err) throw err;
    res.render('beakfastList', { recipes: results, user });
  });
});


// DISPLAYING SALADS LIST //
app.get('/saladsList', (req, res) => {
  const user = req.session.user;

  const query = `SELECT r.*, 
    EXISTS (
      SELECT 1 FROM favourites f WHERE f.recipeId = r.recipeId AND f.userId = ?
    ) AS isFavourited 
    FROM recipes r WHERE r.category = 'Salads'`;

  db.query(query, [user?.id || 0], (err, results) => {
    if (err) throw err;
    res.render('saladsList', { recipes: results, user });
  });
});


// SEARCH FUNCTIONALITY //
app.get('/search', (req, res) => {
  const searchQuery = req.query.q;

  if (!searchQuery) {
    return res.send('No search query provided.');
  }

  const sql = 'SELECT * FROM recipes WHERE recipeTitle LIKE ? OR recipeDescription LIKE ?';
  const likeQuery = `%${searchQuery}%`;

  db.query(sql, [likeQuery, likeQuery], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Database error: ' + err.message);
    }

    res.render('searchResults', {
      query: searchQuery,
      recipes: results,
      user: req.session.user
    });
  });
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

// USER DASHBOARD //
app.get('/user', checkAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    // Food categories
    const foodCategories = [
        { name: 'Desserts', image: '/images/foodCategories/desserts.jpg' },
        { name: 'Soups', image: '/images/foodCategories/soups.jpg' },
        { name: 'Breakfast', image: '/images/foodCategories/breakfast.jpg' },
        { name: 'Salads', image: '/images/foodCategories/salads.jpg' },
        { name: 'Side Dishes', image: '/images/foodCategories/side_dishes.jpg' }
    ];

    // Fetch recipes with isFavourited flag
    const sql = `
        SELECT r.*,
          CASE WHEN f.recipeId IS NOT NULL THEN 1 ELSE 0 END AS isFavourited
        FROM recipes r
        LEFT JOIN favourites f
          ON r.recipeId = f.recipeId AND f.userId = ?
    `;

    db.query(sql, [userId], (err, recipes) => {
        if (err) {
            console.error("Error fetching recipes:", err);
            return res.status(500).send("Error loading recipes");
        }

        res.render('user', {
            user: req.session.user,
            recipes,
            categories: foodCategories
        });
    });
});

// ADMIN DASHBOARD //
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

// STARTING THE SERVER //
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`This server is running on 'http://localhost:${PORT}'`)); 
