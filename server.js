
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
  status: { 
    type: String, default: 'Open',
    overdue: Number,
    priority: String, }
}, { collection: 'cases' }); // Explicitly setting the collection name here

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

app.get('/search_by_department', requiresAuth(), (req, res) => {
  res.send(`
    <h1>Search Case Studies by Department</h1>
    <form action="/cases_by_department" method="post">
      <label for="department">Enter Department:</label><br>
      <input type="text" id="department" name="department" required><br><br>
      <input type="submit" value="Search">
    </form>
  `);
});
app.post('/cases_by_department', requiresAuth(), async (req, res) => {
  const { department } = req.body;

  // Fetch and sort case studies by the 'department' field in ascending order
  let caseStudiesSortedByDepartment = await CaseStudy.find({ department: department }).sort({ department: 1 });

  // Prepare the HTML to display the sorted case studies
  let caseStudiesDetails = caseStudiesSortedByDepartment.map(caseStudy => `
    <div>
      <h3>Ticket ID: ${caseStudy.ticket_id}</h3>
      <p>Created By: ${caseStudy.created_by}</p>
      <p>Date Created: ${new Date(caseStudy.date_created).toLocaleString()}</p>
      <p>Message: ${caseStudy.message}</p>
      <p>Department: ${caseStudy.department}</p>
      <p>Student ID: ${caseStudy.student_id}</p>
      <p>Status: ${caseStudy.status}</p>
    </div>
  `).join('');

  // Send the HTML response
  res.send(`
    <h1>Case Studies in ${department} Department</h1>
    <div>${caseStudiesDetails}</div>
  `);
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