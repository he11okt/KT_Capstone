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

app.use(session({
  secret: 'this should be a real secret',
  resave: true,
  saveUninitialized: false,
  cookie: {
    secure: false, // Note that the cookie.secure option should be enabled in a production application to ensure cookies are only sent over HTTPS
  },
}));

// MongoDB setup
mongoose.connect('mongodb://localhost:27017/myApp', { useNewUrlParser: true, useUnifiedTopology: true });

const UserSchema = new mongoose.Schema({ 
  name: String, 
  email: String
});
const User = mongoose.model('User', UserSchema);

// Modify the CaseStudySchema to include a status field
const CaseStudySchema = new mongoose.Schema({
  ticket_id: String,
  created_by: String,
  date_created: Date,
  message: String,
  department: String,
  completed_by : { 
    name : String, 
    completed : String 
  }, 
  student_id: String,
  status: { type: String, default: 'Open' } // Add this line
});
const CaseStudy = mongoose.model('CaseStudy', CaseStudySchema);


// Auth0 setup
app.use(auth(config));
app.use(express.urlencoded());
app.use(bodyParser.urlencoded({ extended: true }));
app.get('/', (req, res) => {
  res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

// User Profile and DB save
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

  // Fetch open case studies created by the logged in user
  let caseStudies = await CaseStudy.find({ created_by: name, status: 'Open' });

  let caseStudyCount = caseStudies.length;

  let caseStudyDetails = caseStudies.map(casestudy => `
    <p>Ticket ID: ${casestudy.ticket_id}</p>
    <p>Date Created: ${casestudy.date_created}</p>
    <p>Message: ${casestudy.message}</p>
    <p>Department: ${casestudy.department}</p>
    <p>Student ID: <a href="/user/${casestudy.student_id}">${casestudy.student_id}</a></p>
  `).join('');
  
  res.send(`
    <h1>${name}'s Dashboard</h1>
    <h2>You have ${caseStudyCount} open case studies</h2>
    <div>${caseStudyDetails}</div>
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
      <label for="student_id">Student ID:</label><br>
      <input type="text" id="student_id" name="student_id"><br>
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
    ticket_id: uuid.v4(),  // Use uuid to generate a new random ticket id
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
      <label for="ticket_id">Ticket ID:</label><br>
      <input type="text" id="ticket_id" name="ticket_id"><br>
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

// Handle a status update 
app.post('/setStatus', requiresAuth(), async (req, res) => {
  
  let ticket_id = req.body.ticket_id;
  let newStatus = req.body.status;

  await CaseStudy.updateOne({ ticket_id: ticket_id }, { status: newStatus }); 

  res.send(`Case study ${ticket_id} status successfully updated to ${newStatus}.`);
});

// Display cases with status 'Closed'
app.get('/closed', requiresAuth(), async (req, res) => {
  let closedCases = await CaseStudy.find({ status: 'Closed' });

  let closedCaseCount = closedCases.length;

  let caseDetails = closedCases.map(caseStudy => `
    <p>Ticket ID: ${caseStudy.ticket_id}</p>
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
      <label for="ticket_id">Ticket ID:</label><br>
      <input type="text" id="ticket_id" name="ticket_id"><br>
      <input type="submit" value="Find Case Study">
    </form>
    <a href="/dashboard">Dashboard</a>
  `;

  res.send(form);
});

app.post('/find_case', requiresAuth(), async (req, res) => {
  let ticket_id = req.body.ticket_id;
  
  let caseStudy = await CaseStudy.findOne({ ticket_id: ticket_id });
  
  if(caseStudy) {
    res.send(`
      <h1>Case Study Found</h1>
      <p>Ticket ID: ${caseStudy.ticket_id} </p>
      <p>Created By: ${caseStudy.created_by} </p>
      <p>Date Created: ${caseStudy.date_created} </p>
      <p>Message: ${caseStudy.message} </p>
      <p>Department: ${caseStudy.department} </p>
      <p>Student ID: ${caseStudy.student_id} </p>
      <p>Status: ${caseStudy.status} </p>
    `);
  } else {
    res.send(`
      <h1>No Case Study Found for Ticket ID: ${ticket_id}</h1>
    `);
  }
});


// User Profile Route
app.get('/user/:email', requiresAuth(), async (req, res) => {
  let email = req.params.email;
  
  const user = await User.findOne({ email: email });
  
  if (user) {
    res.send(`
      <h1>User Profile</h1>
      <p>Name: ${user.name}</p>
      <p>Email: ${user.email}</p>
    `);
  } else {
    res.send('User not found');
  }
});

app.listen(3000, () => console.log('App listening on port 3000'));