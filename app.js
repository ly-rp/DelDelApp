//After making changes for any of the files, go to source control then, 
//then type ur name and number (like Eleanor#01), then press the button 'Commit'. That way we can track the codes. 
// Testing
// Test
//Base Template taken from Lesson 20's RegisterApp's app.js//
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();


// Database connection, change it?????//
const db = mysql.createConnection({
    host: 'oowidc.h.filess.io',
    user: 'Team34C237_gradecutgo',
    password: 'd26e4e85de269129b7c4eacb96801d1bcea66855',
    database: 'Team34C237_gradecutgo',
    port: 3307 // Used the Port Number Provided by Filess.io
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//Session Middleware//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    //Session expires after one week of inactivity
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7}
}))

app.use(flash());

// Setting up EJS//
app.set('view engine', 'ejs');

//Middleware to check if user is logged in//
const checkAuthenticated =(req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resourse');
        res.redirect('/login');
    }
};

//******** TODO: Create a Middleware to check if user is admin. ********//
const checkAdmin =(req, res, next) => {
    if (req.session.user.role==='admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
}

// Test

// Routes
app.get('/', (req, res) => {
    const sql = 'SELECT * FROM student';
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving student data');
        }
        res.render('index', { student: results });
    });
});

app.get('/student/:id', (req, res) => {
    const studentId = req.params.id;
    const sql = 'SELECT * FROM student WHERE studentId = ?';
    connection.query(sql, [studentId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving student by ID');
        }
        if (results.length > 0) {
            res.render('student', { student: results[0] });
        } else {
            res.status(404).send('student not found');
        }
    });
});

app.get('/addStudent', (req, res) => {
    res.render('addStudent');
});


app.post('/addStudent',upload.single('image'), (req, res) => {
    // Extract student data from the request body
    const {name, dob, contact} = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = 'noImage.png'; // Use noImage.png if none uploaded
    }

    const sql = 'INSERT INTO student (name, dob, contact, image) VALUES (?, ?, ?, ?)';
    connection.query(sql , [name, dob, contact, image], (error, results) => { 
        if (error) {
            console.error("Error adding student:", error);
            res.status(500).send('Error adding student');
        } else {
            res.redirect('/');
        }
    });
});

app.get('/editStudent/:id', (req, res) => {
    const studentId = req.params.id;
    const sql = 'SELECT * FROM student WHERE studentId = ?';
    connection.query(sql, [studentId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving student for editing');
        }
        if (results.length > 0) {
            res.render('editStudent', { student: results[0] });
        } else {
            res.status(404).send('student not found');
        }
    });
});

app.post('/editStudent/:id',upload.single('image'), (req, res) => {
    const studentId = req.params.id;
    
    const { name, dob, contact} = req.body;
    let image = req.body.currentImage; // retrieve current image filename
    if (req.file) { // if new image is uploaded
        image = req.file.filename; // set image to be new image filename
    } else if (!image) {
        image = 'noImage.png'; // Use noImage.png only if there is no current image
    }


    const sql = 'UPDATE student SET name = ?, dob = ?, contact = ?, image = ? WHERE studentId = ?';

    //insert the new student into the database
    connection.query( sql, [name, dob, contact, image, studentId], (error, results) => {
        if (error) {
            //Handle any error that occurs during the database operation
            console.error("Error updating student:", error);
            res.status(500).send('Error updating student');
        } else {
            //Send a success response
            res.redirect('/');
        }
    });
});

app.get('/deletestudent/:id', (req, res) => {
    const studentId = req.params.id;
    const sql = 'DELETE FROM student WHERE studentId = ?';
    connection.query(sql, [studentId], (error, results) => {
        if (error) {
            //Handle any error that occurs during the database operation
            console.error("Error deleting student:", error);
            res.status(500).send('Error deleting student');
        } else {
            //send a success response
            res.redirect('/');
        }
    });
});


//******** TODO: Create a middleware function validateRegistration ********//
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
            //******** TODO: IUpdate to redirect users to /dashboard route upo successful log in ********//
            res.redirect('/dashboard');
        } else {
            //Invalid credentials
            req.flash('error', 'Invalid email or password');
            res.redirect('/login');
        }
    });
});

//******** TODO: Insert code for dashboard route to render dashboard page for users. ********//
app.get('/dashboard', checkAuthenticated, (req, res) => {
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

// Starting the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`)); 