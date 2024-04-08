
//installing different apps need for code//
const express = require('express');
const session = require('express-session');
const { auth, requiresAuth } = require('express-openid-connect');
const mongoose = require('mongoose');
const uuid = require('uuid');
const bodyParser = require('body-parser')



const app = express();
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: '21ef64ec95a15293d93132e30b1b782142537979d7d3d14ef0f6d445fad31f26',
  baseURL: 'http://localhost:3000',
  clientID: 'Xhnwxt2yGJ2gGdLRDWPtnrdQF2oppST9',
  issuerBaseURL: 'https://trainingcontractconnect.au.auth0.com'
};

// Serve static files from the 'public' directory
app.use(express.static('public'));



// running app w/ SSO//
app.use(session({
  secret: 'this should be a real secret',
  resave: true,
  saveUninitialized: false,
  cookie: {
    secure: false, // Note that the cookie.secure option should be enabled in a production application to ensure cookies are only sent over HTTPS
  },
}));

// MongoDB setup
mongoose.connect('mongodb+srv://n11099551:November10@tcc.fzo98oj.mongodb.net/TCC?retryWrites=true&w=majority&appName=TCC', { useNewUrlParser: true, useUnifiedTopology: true });


const ContactSchema = new mongoose.Schema({
  mobile: String,
  phone: String,
  email: String,
});

const GuardianSchema = new mongoose.Schema({
  full_name: String,
  relationship: String,
  contact: [ContactSchema],
});

const EducationSchema = new mongoose.Schema({
  highest_cert: String,
  institute: String,
  time_credit: String,
  other_studies: String,
});

const CitizenshipSchema = new mongoose.Schema({
  status: String,
  ATSI: String,
  country_of_birth: String,
  language: String,
});

const AddressSchema = new mongoose.Schema({
  street: String,
  suberb: String,
  postcode: String,
  state: String,
});

const UserSchema = new mongoose.Schema({
  name: String, // Consider splitting into first_name and last_name if needed
  email: String,
  role: String, // Existing fields
  student_id: String,
  last_name: String,
  first_name: String,
  mobile: String,
  dob: String,
  disability: String,
  USI: String,
  res_address: [AddressSchema],
  citizenship: [CitizenshipSchema],
  education: [EducationSchema],
  guardian: [GuardianSchema],
}, { collection: 'users' });

const userSchema = new mongoose.Schema({}, { collection: 'users' }); // Assuming no specific schema, adjust if needed
const User = mongoose.model('User', UserSchema);

// Modify the CaseStudySchema to include a status field
const CaseStudySchema = new mongoose.Schema({
  case_id: String,
  created_by: String,
  date_created: Date,
  message: String,
  department: String,
  completed_by : { 
    name : String, 
    completed : String 
  }, 
  student_id: String,
  status: { 
    type: String, default: 'Open',
    overdue: Number,
    priority: String, }
}, { collection: 'cases' }); // Explicitly setting the collection name here

const CaseStudy = mongoose.model('CaseStudy', CaseStudySchema);




// ---------------- Routes/Functions ------------------ // 

// Auth0 setup
app.use(auth(config));
app.use(express.urlencoded());
app.use(bodyParser.urlencoded({ extended: true }));
app.get('/', (req, res) => {
res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

// New Authenticated route with getAllUsers functionality - getAllUsers not working. 
// see line 502 for working getAllUsers functionality - only accessed thru /users.  
// app.get('/', async (req, res) => {
//   console.log("Accessed '/' route"); // Log entry into route handler
//   console.log("Is Authenticated?", req.oidc.isAuthenticated()); // Log authentication status
//   if (req.oidc.isAuthenticated()) {
//     // Proceed to fetch and display all users if the user is logged in
//     try {
//       const users = await getAllUsers(); // Assuming this function is defined and works correctly
//       let usersHtml = users.map(user => `
//           <tr>
//               <td>${user.name || ''}</td>
//               <td>${user.email || ''}</td>
//               <td>${user.role || ''}</td>
//               <td>${user.student_id || ''}</td>
//           </tr>
//       `).join('');

//       res.send(`
//           <!DOCTYPE html>
//           <html lang="en">
//           <head>
//               <meta charset="UTF-8">
//               <title>Home - Users List</title>
//               <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
//           </head>
//           <body>
//               <div class="container mt-5">
//                   <h2>Registered Users</h2>
//                   <table class="table">
//                       <thead>
//                           <tr>
//                               <th>Name</th>
//                               <th>Email</th>
//                               <th>Role</th>
//                               <th>Student ID</th>
//                           </tr>
//                       </thead>
//                       <tbody>
//                           ${usersHtml}
//                       </tbody>
//                   </table>
//               </div>
//           </body>
//           </html>
//       `);
//     } catch (error) {
//       console.error('Failed to fetch users:', error);
//       res.status(500).send('Internal Server Error');
//     }
//   } else {
//     // User is not logged in, display a simple login message
//     res.send('Logged out');
//   }
// });


// User Profile and DB save what is this???
app.get('/profile', requiresAuth(), async (req, res) => {
  let email = req.oidc.user.email;
  let name = req.oidc.user.name;

  let existingUser = await User.findOne({ email: email });
  if (!existingUser) {
    const newUser = new User({ name: name, email: email });
    let result = await newUser.save();
    console.log("User successfully saved to database.");
} else {
    console.log("User already exists in the database.");
}

  res.redirect('/dashboard'); // Add this line here
});

app.get('/dashboard', requiresAuth(), async (req, res) => {
  let name = req.oidc.user.name;

  // Fetch open case studies created by the logged in user HMM 
  // TO DO!!! > Fetch open cases assigned by logged in user's department 
  let caseStudies = await CaseStudy.find({ created_by: name, status: 'Open' });

  let caseStudyCount = caseStudies.length;

  let caseStudyDetails = caseStudies.map(casestudy => `
    <p>Case ID: ${casestudy.case_id}</p>
    <p>Date Created: ${casestudy.date_created}</p>
    <p>Message: ${casestudy.message}</p>
    <p>Department: ${casestudy.department}</p>
    <p>Status: ${casestudy.status}</p>
    <p>Student ID: <a href="/user/${casestudy.student_id}">${casestudy.student_id}</a></p>
  `).join('');
  
  res.send(`
    <h1>${name}'s Dashboard</h1>
    <h2>You have ${caseStudyCount} open case studies</h2>
    <div>${caseStudyDetails}</div>
    <a href="/update-profile">update-profile</a>
    <a href="/create_case">Create Case</a>
    <a href="/setStatus">Set Status for a Case</a>
    <a href="/closed">See Closed Cases</a>
    <a href="/find_case">Find Case</a>
  `);
});

// Render form to create a new case study
app.get('/create_case', requiresAuth(), (req, res) => {
  let name = req.oidc.user.name;

  let form = `
    <h1>Create a new case for ${name}</h1>
    <form action="/create_case" method="POST">
      <label for="message">Message:</label><br>
      <input type="text" id="message" name="message"><br>
      <label for="department">Department:</label><br>
      <input type="text" id="department" name="department"><br>
      <label for="student_email">Student Email:</label><br>
      <input type="text" id="student_email" name="student_email"><br>
      <input type="submit" value="Submit">
    </form>
    <a href="/dashboard">Dashboard</a>
  `;

  res.send(form);
});

// Handle form submission to create a new case
app.post('/create_case', requiresAuth(), async (req, res) => {
  let name = req.oidc.user.name;
  let email = req.oidc.user.email;

  var new_case = {
    case_id: uuid.v4(),  // Use uuid to generate a new random case id
    created_by: name,
    date_created: new Date(),
    message: req.body.message,
    department: req.body.department,
    completed_by: { "name" : "", "completed" : "false" },
    student_id: req.body.student_id
  };

  const newCaseStudy = new CaseStudy(new_case);
  let result = await newCaseStudy.save();

  res.send("Case study successfully created.");
});

app.get('/setStatus', requiresAuth(), (req, res) => {
  let form = `
    <h1>Set Case Study Status</h1>
    <form action="/setStatus" method="POST">
      <label for="case_id">Case ID:</label><br>
      <input type="text" id="case_id" name="case_id"><br>
      <label for="status">Status:</label><br>
      <select name="status" id="status">
        <option value="Open">Open</option>
        <option value="Closed">Closed</option>
      </select>
      <input type="submit" value="Set Status">
    </form>
    <a href="/dashboard">Go Back to Dashboard</a>
  `;

  res.send(form);
});

// Handle a status update from Open to Close and vice versa
app.post('/setStatus', requiresAuth(), async (req, res) => {
  
  let case_id = req.body.case_id;
  let newStatus = req.body.status;

  await CaseStudy.updateOne({ case_id: case_id }, { status: newStatus }); 

  res.send(`Case study ${case_id} status successfully updated to ${newStatus}.`);
});

// Display cases with status 'Closed' !! do i still need this if /search can search by all fields???
app.get('/closed', requiresAuth(), async (req, res) => {
  let closedCases = await CaseStudy.find({ status: 'Closed' });

  let closedCaseCount = closedCases.length;

  let caseDetails = closedCases.map(caseStudy => `
    <p>Ticket ID: ${caseStudy.case_id}</p>
    <p>Status: ${caseStudy.status}</p>
  `).join('');

  res.send(`
    <h1>Closed Cases</h1>
    <h2>You have ${closedCaseCount} closed case studies</h2>
    <div>${caseDetails}</div>
  `);
});

app.get('/find_case', requiresAuth(), (req, res) => {
  let form = `
    <h1>Find Case Study</h1>
    <form action="/find_case" method="POST">
      <label for="case_id">Case ID:</label><br>
      <input type="text" id="case_id" name="case_id"><br>
      <input type="submit" value="Find Case Study">
    </form>
    <a href="/dashboard">Dashboard</a>
  `;

  res.send(form);
});

app.post('/find_case', requiresAuth(), async (req, res) => {
  let case_id = req.body.case_id;
  
  let caseStudy = await CaseStudy.findOne({ case_id: case_id });
  
  if(caseStudy) {
    res.send(`
      <h1>Case Study Found</h1>
      <p>Case ID: ${caseStudy.case_id} </p>
      <p>Created By: ${caseStudy.created_by} </p>
      <p>Date Created: ${caseStudy.date_created} </p>
      <p>Message: ${caseStudy.message} </p>
      <p>Department: ${caseStudy.department} </p>
      <p>Student ID: ${caseStudy.student_id} </p>
      <p>Status: ${caseStudy.status} </p>
    `);
  } else {
    res.send(`
      <h1>No Case Study Found for Ticket ID: ${case_id}</h1>
    `);
  }
});

//Search a Case
app.get('/search', requiresAuth(), (req, res) => {
  res.send(`
    <h1>Search Case Studies</h1>
    <form action="/search" method="post">
      <label for="searchType">Search By:</label>
      <select name="searchType" id="searchType">
        <option value="department">Department</option>
        <option value="case_id">Case ID</option>
        <option value="status">Status</option>
        <option value="priority">Priority</option>
        <option value="created_by">Created By (Student Name)</option>
      </select>
      <br>
      <label for="searchValue">Search Value:</label>
      <input type="text" id="searchValue" name="searchValue" required>
      <br><br>
      <input type="submit" value="Search">
    </form>
  `);
});

app.post('/search', requiresAuth(), async (req, res) => {
  const { searchType, searchValue } = req.body;

  let query = {};

  switch (searchType) {
    case 'department':
      query = { department: searchValue };
      break;
    case 'case_id':
      query = { case_id: searchValue };
      break;
    case 'status':
      query = { 'status': searchValue };
      break;
    //case 'priority':
      //query = { 'status.priority': searchValue };
      //break;
    case 'created_by':
      query = { created_by: searchValue };
      break;
    default:
      res.send('Invalid search type.');
      return;
  }

  try {
    const caseStudies = await CaseStudy.find(query);

    if (caseStudies.length > 0) {
      const caseStudiesDetails = caseStudies.map(caseStudy => `
        <div>
          <h3>Case ID: ${caseStudy.case_id}</h3>
          <p>Created By: ${caseStudy.created_by}</p>
          <p>Date Created: ${new Date(caseStudy.date_created).toLocaleString()}</p>
          <p>Message: ${caseStudy.message}</p>
          <p>Department: ${caseStudy.department}</p>
          <p>Status: ${caseStudy.status}</p> <!-- Use optional chaining -->
          <!-- <p>Priority: ${caseStudy.status?.priority}</p> <!-- Use optional chaining -->
          <p>Student ID: ${caseStudy.student_id}</p> -->
        </div>
      `).join('');

      res.send(`
        <h1>Search Results</h1>
        <div>${caseStudiesDetails}</div>
      `);
    } else {
      res.send('No matching case studies found.');
    }
  } catch (error) {
    console.error('Error searching case studies:', error);
    res.status(500).send('Internal Server Error');
  }
});


// User Profile Route
app.get('/user/:email', requiresAuth(), async (req, res) => {
  let email = req.params.email;
  
  const user = await User.findOne({ email: email });
  
  if (user && user.res_address.length > 0) {
    // Assuming user.res_address is an array and you want to display the first address
    const firstAddress = user.res_address[0];
  
  if (user && user.citizenship.length > 0) {
      // Assuming user.res_address is an array and you want to display the first address
    const firstStatus = user.citizenship[0];

    res.send(`
      <h1>User Profile</h1>
      <p>Name: ${user.first_name} ${user.last_name}</p>
      <p>Student ID: ${user.student_id}</p>
      <p>Email: ${user.email}</p>

      <p>Mobile: ${user.mobile}</p>
      <p>Date of Birth: ${user.dob}</p>
      <p>Any Disability?: ${user.disability}</p>
      <p>USI: ${user.USI}</p>
      <p>Residential Address:<br>
          Street: ${firstAddress.street} <br>
          Suburb: ${firstAddress.suberb} <br>
          Postcode: ${firstAddress.postcode} <br>
          State: ${firstAddress.state}          
          </p>
      <p>Citizenship Status: <br>
          Status: ${firstStatus.status} <br>
          ATSI: ${firstStatus.ATSI} <br>
          Country of Birth: ${firstStatus.country_of_birth} <br>
          Home Language: ${firstStatus.language}
          </p>
      <p>Education History: ${user.education}</p>
      <p>Emergency Contact: ${user.guardian}</p>
    `);
  } else {
    res.send('User not found or no address available');
  }
}});


app.get('/authorities/:email', requiresAuth(), async (req, res) => {
  let email = req.params.email;
  
  const user = await User.findOne({ email: email });
  
  if (user) {
    res.send(`
      <h1>User Profile</h1>
      <p>Name: ${user.first_name} ${user.last_name}</p>
      <p>Student ID: ${user.student_id}</p>
      <p>Email: ${user.email}</p>
    `);
  } else {
    res.send('User not found');
  }
});

app.listen(3000, () => console.log('App listening on port 3000'));


// Fetch all users - WANT TO PUT THIS AS 'MAIN'. 
async function getAllUsers() {
  console.log("Entered getAllUsers function"); // Log entry into function
  try {
    const users = await User.find({});
    console.log("Users fetched:", users); // Log fetched data
    return users; // Returns an array of user documents
  } catch (error) {
    console.error('Error fetching users from database:', error);
    throw error; // Rethrow or handle error as needed
  }
 }
app.get('/users', async (req, res) => {
  try {
    const users = await getAllUsers(); // Fetch all users
    let usersHtml = users.map(user => `
        <tr>
            <td>${user.name || ''}</td>
            <td>${user.email || ''}</td>
            <td>${user.role || ''}</td>
            <td>${user.student_id || ''}</td>
        </tr>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Home - Users List</title>
            <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        </head>
        <body>
            <div class="container mt-5">
                <h2>Registered Students</h2>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Student ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${usersHtml}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).send('Internal Server Error');
  }
});

