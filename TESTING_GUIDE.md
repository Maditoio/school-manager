# Testing Guide - School-Parent Communication Platform

## Prerequisites
- Dev server running at http://localhost:3000
- Database seeded with demo data

## Demo Accounts

### Super Admin
- **Email:** admin@demo.com
- **Password:** password123
- **Access:** Platform-wide management

### School Admin
- **Email:** schooladmin@demo.com
- **Password:** password123
- **Access:** School management (Demo School)

### Teacher
- **Email:** teacher@demo.com
- **Password:** password123
- **Access:** Class and student management

### Parent
- **Email:** parent@demo.com
- **Password:** password123
- **Access:** View children's information

---

## Testing Super Admin Functions

### 1. Login as Super Admin
```
http://localhost:3000/login
Email: admin@demo.com
Password: password123
```

### 2. Test Dashboard
- URL: `/super-admin/dashboard`
- ✅ View platform statistics:
  - Total Schools
  - Active Schools
  - Total Users
  - Total Students

### 3. Test Schools Management
- URL: `/super-admin/schools`
- ✅ View all schools in the platform
- ✅ Add new school (Fill form with school details)
- ✅ Edit existing school
- ✅ Delete school
- ✅ Toggle school active status

**Test Case - Add School:**
1. Click "Add School" button
2. Fill form:
   - Name: Test School
   - Email: test@school.com
   - Phone: +1234567890
   - Address: 123 School St
   - Subscription Plan: BASIC
   - Status: ACTIVE
3. Click "Create"
4. Verify school appears in list

### 4. Test Analytics
- URL: `/super-admin/analytics`
- ✅ View platform analytics:
  - Total Schools count
  - Active Schools count
  - Total Users count
  - Total Students count
  - Schools by subscription plan (chart)
  - Recently added schools list

---

## Testing School Admin Functions

### 1. Login as School Admin
```
http://localhost:3000/login
Email: schooladmin@demo.com
Password: password123
```

### 2. Test Dashboard
- URL: `/admin/dashboard`
- ✅ View school statistics:
  - Total Students
  - Total Teachers
  - Total Classes
  - Attendance Rate (today)

### 3. Test Students Management
- URL: `/admin/students`
- ✅ View all students in table format
- ✅ Add new student
- ✅ Edit existing student
- ✅ Delete student
- ✅ View student details (admission number, class, DOB, parent)

**Test Case - Add Student:**
1. Click "Add Student" button
2. Fill form:
   - First Name: John
   - Last Name: Doe
   - Admission Number: STU001
   - Date of Birth: 2010-01-01
   - Gender: Male
   - Class: Select from dropdown
   - Parent: Select from dropdown
3. Click "Create"
4. Verify student appears in table

### 4. Test Teachers Management
- URL: `/admin/teachers`
- ✅ View all teachers as cards
- ✅ Add new teacher account
- ✅ Delete teacher
- ✅ View teacher details (name, email, join date)

**Test Case - Add Teacher:**
1. Click "Add Teacher" button
2. Fill form:
   - First Name: Jane
   - Last Name: Smith
   - Email: jane.smith@demo.com
   - Password: password123
3. Click "Create"
4. Verify teacher appears in list

### 5. Test Classes Management
- URL: `/admin/classes`
- ✅ View all classes as cards
- ✅ Add new class
- ✅ Edit class (name, teacher)
- ✅ Delete class
- ✅ View student count per class

**Test Case - Add Class:**
1. Click "Add Class" button
2. Fill form:
   - Class Name: Grade 5A
   - Class Teacher: Select teacher
3. Click "Create"
4. Verify class appears

### 6. Test Subjects Management
- URL: `/admin/subjects`
- ✅ View all subjects as cards
- ✅ Add new subject
- ✅ Edit subject (name, code, teacher)
- ✅ Delete subject
- ✅ View subject teacher

**Test Case - Add Subject:**
1. Click "Add Subject" button
2. Fill form:
   - Subject Name: Mathematics
   - Subject Code: MATH101
   - Teacher: Select teacher
3. Click "Create"
4. Verify subject appears

### 7. Test Attendance Management
- URL: `/admin/attendance`
- ✅ Select class
- ✅ Select date
- ✅ Mark students as Present/Absent/Late
- ✅ Save attendance
- ✅ View existing attendance records

**Test Case - Mark Attendance:**
1. Select a class from dropdown
2. Select today's date
3. Mark each student status:
   - Click "Present" for present students
   - Click "Absent" for absent students
   - Click "Late" for late students
4. Click "Save Attendance"
5. Verify success message

### 8. Test Results Management
- URL: `/admin/results`
- ✅ View all results in table
- ✅ Add new result
- ✅ Publish draft results
- ✅ Delete results
- ✅ View result details (student, subject, score, grade)

**Test Case - Add Result:**
1. Click "Add Result" button
2. Fill form:
   - Student: Select student
   - Subject: Select subject
   - Exam Type: Midterm
   - Score: 85
   - Max Score: 100
3. Click "Create"
4. Verify result appears as "Draft"
5. Click "Publish" to make it visible to parents

### 9. Test Announcements
- URL: `/admin/announcements`
- ✅ View all announcements
- ✅ Create new announcement
- ✅ Edit announcement
- ✅ Delete announcement
- ✅ View announcement author and timestamp

**Test Case - Create Announcement:**
1. Click "New Announcement" button
2. Fill form:
   - Title: School Holiday Update
   - Content: School will be closed next Monday for maintenance.
3. Click "Create"
4. Verify announcement appears with your name

### 10. Test Messages
- URL: `/admin/messages`
- ✅ View all messages
- ✅ Send new message
- ✅ Filter by All/Sent/Received
- ✅ Mark messages as read
- ✅ Delete messages

**Test Case - Send Message:**
1. Click "New Message" button
2. Select recipient (teacher or parent)
3. Type message content
4. Click "Send"
5. Verify message appears in "Sent" tab

---

## Testing Teacher Functions

### 1. Login as Teacher
```
http://localhost:3000/login
Email: teacher@demo.com
Password: password123
```

### 2. Test Dashboard
- URL: `/teacher/dashboard`
- ✅ View teacher statistics:
  - My Classes count
  - My Students count
  - My Subjects count
  - Pending Results count

### 3. Test My Classes
- URL: `/teacher/classes`
- ✅ View classes assigned to you
- ✅ View student count per class

### 4. Test Students
- URL: `/teacher/students`
- ✅ Select class to view students
- ✅ View student list in table
- ✅ View student details (admission no, name, gender, DOB)

### 5. Test Attendance
- URL: `/teacher/attendance`
- ✅ Select your class
- ✅ Select date
- ✅ Mark attendance (Present/Absent/Late)
- ✅ Save attendance
- ✅ View existing attendance

**Test Case - Mark Attendance:**
1. Select your class
2. Select today's date
3. Mark each student's attendance
4. Click "Save Attendance"
5. Verify success message

### 6. Test Results
- URL: `/teacher/results`
- ✅ View results for your subjects
- ✅ Add new result for students
- ✅ Publish results
- ✅ Delete results

**Test Case - Enter Results:**
1. Click "Add Result" button
2. Select student from your class
3. Select your subject
4. Enter score and max score
5. Click "Create"
6. Click "Publish" to make visible to parents

### 7. Test Announcements
- URL: `/teacher/announcements`
- ✅ View all school announcements
- ✅ Read announcement details

### 8. Test Messages
- URL: `/teacher/messages`
- ✅ View all messages
- ✅ Send messages to parents and admins
- ✅ Reply to received messages
- ✅ Mark messages as read
- ✅ Filter messages

---

## Testing Parent Functions

### 1. Login as Parent
```
http://localhost:3000/login
Email: parent@demo.com
Password: password123
```

### 2. Test Dashboard
- URL: `/parent/dashboard`
- ✅ View parent statistics:
  - My Children count
  - Unread Messages count
  - Attendance Rate
  - Total Attendance Records

### 3. Test My Children
- URL: `/parent/children`
- ✅ View all your children as cards
- ✅ View child details:
  - Name
  - Admission Number
  - Class
  - Date of Birth
  - Gender

### 4. Test Attendance
- URL: `/parent/attendance`
- ✅ Select child from dropdown
- ✅ View attendance history table
- ✅ View attendance status for each date
- ✅ Color-coded status (Green=Present, Red=Absent, Yellow=Late)

### 5. Test Results
- URL: `/parent/results`
- ✅ Select child from dropdown
- ✅ View published results table
- ✅ View subject, score, percentage, grade
- ✅ Color-coded grades (A=Green, B=Blue, C=Yellow, D=Orange, F=Red)

### 6. Test Announcements
- URL: `/parent/announcements`
- ✅ View all school announcements
- ✅ Read announcement details
- ✅ View announcement date and author

### 7. Test Messages
- URL: `/parent/messages`
- ✅ View all messages
- ✅ Send messages to teachers and admins
- ✅ Reply to received messages
- ✅ Mark messages as read
- ✅ Filter by All/Sent/Received

**Test Case - Send Message to Teacher:**
1. Click "New Message" button
2. Select teacher from dropdown
3. Type message: "When is the next parent-teacher meeting?"
4. Click "Send"
5. Verify message appears in "Sent" tab

---

## Common Testing Scenarios

### Scenario 1: Complete Student Lifecycle
1. **School Admin**: Add a new student
2. **School Admin**: Assign student to a class
3. **Teacher**: Mark attendance for the student
4. **Teacher**: Enter exam results for the student
5. **Teacher**: Publish the results
6. **Parent**: Login and view child's attendance
7. **Parent**: View child's published results

### Scenario 2: Communication Flow
1. **Parent**: Send message to teacher asking about homework
2. **Teacher**: Login and read the message
3. **Teacher**: Reply to parent's message
4. **Parent**: Read teacher's reply
5. **School Admin**: Create announcement about school event
6. **All Users**: View the announcement

### Scenario 3: Academic Reporting
1. **Teacher**: Enter results for all students in a subject
2. **Teacher**: Publish the results
3. **School Admin**: View results overview
4. **Parent**: Login and check child's grades
5. **Parent**: Send message to teacher about results

---

## API Endpoints Testing

### Schools API
```bash
# Get all schools (Super Admin only)
curl http://localhost:3000/api/schools

# Create school (Super Admin only)
curl -X POST http://localhost:3000/api/schools \
  -H "Content-Type: application/json" \
  -d '{"name":"Test School","email":"test@school.com","phone":"123",...}'
```

### Students API
```bash
# Get all students
curl http://localhost:3000/api/students

# Get students by class
curl http://localhost:3000/api/students?classId=CLASS_ID

# Get students by parent
curl http://localhost:3000/api/students?parentId=PARENT_ID
```

### Attendance API
```bash
# Get attendance by date
curl http://localhost:3000/api/attendance?date=2024-02-18

# Get attendance by student
curl http://localhost:3000/api/attendance?studentId=STUDENT_ID

# Mark attendance
curl -X POST http://localhost:3000/api/attendance \
  -H "Content-Type: application/json" \
  -d '{"records":[{"studentId":"ID","date":"2024-02-18","status":"PRESENT"}]}'
```

---

## Verification Checklist

### Super Admin ✓
- [ ] Can access super-admin dashboard
- [ ] Can view all schools
- [ ] Can create, edit, delete schools
- [ ] Can view platform analytics
- [ ] Cannot access school-specific pages

### School Admin ✓
- [ ] Can access admin dashboard
- [ ] Can manage students (CRUD)
- [ ] Can manage teachers (CR_D)
- [ ] Can manage classes (CRUD)
- [ ] Can manage subjects (CRUD)
- [ ] Can mark attendance
- [ ] Can enter and publish results
- [ ] Can create announcements
- [ ] Can send/receive messages
- [ ] Cannot access super-admin pages

### Teacher ✓
- [ ] Can access teacher dashboard
- [ ] Can view assigned classes
- [ ] Can view students in their classes
- [ ] Can mark attendance for their classes
- [ ] Can enter and publish results
- [ ] Can view announcements
- [ ] Can send/receive messages
- [ ] Cannot access admin pages

### Parent ✓
- [ ] Can access parent dashboard
- [ ] Can view their children
- [ ] Can view attendance records
- [ ] Can view published results
- [ ] Can view announcements
- [ ] Can send/receive messages
- [ ] Cannot access teacher/admin pages

---

## Known Issues & Notes

1. **React Hook Warnings**: ESLint warnings about exhaustive-deps are expected and safe to ignore
2. **Authentication**: Sessions persist across page reloads via JWT
3. **Multi-tenancy**: All data is filtered by school ID automatically (except super admin)
4. **Middleware**: Routes are protected based on user roles

---

## Performance Testing

### Load Testing Suggestions
1. Create 100+ students via API
2. Mark attendance for all students
3. Enter results for multiple subjects
4. Send messages between multiple users
5. Monitor response times and database queries

### Database Queries to Monitor
- Student list queries (check indexes)
- Attendance queries by date range
- Results queries with joins
- Message queries with pagination

---

## Next Steps

1. ✅ All pages implemented
2. ✅ All roles functional
3. ✅ Multi-tenant security working
4. 🔄 Add pagination for large datasets
5. 🔄 Add search/filter functionality
6. 🔄 Add export features (PDF reports)
7. 🔄 Add email notifications
8. 🔄 Add mobile responsive improvements
9. 🔄 Add unit and integration tests
10. 🔄 Add performance optimizations

---

## Support

For issues or questions:
- Check the console for error messages
- Verify database connection
- Ensure all environment variables are set
- Check middleware for route protection
- Review API response status codes
