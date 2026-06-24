const fs = require('fs');
const path = require('path');

// Check if the required files exist
const requiredFiles = [
  'src/app/page.tsx',
  'src/app/login/page.tsx',
  'src/components/Navigation.tsx',
  'src/components/LoginForm.tsx',
  'src/app/layout.tsx',
  'src/app/globals.css'
];

console.log('Testing navigation between pages...');
console.log('Checking if all required files exist:');

let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`${exists ? '✓' : '✗'} ${file}`);
  if (!exists) {
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log('\nAll required files exist!');
  
  // Check if Navigation component has links to both pages
  const navigationContent = fs.readFileSync(path.join(__dirname, 'src/components/Navigation.tsx'), 'utf8');
  const hasHomeLink = navigationContent.includes('href="/"');
  const hasLoginLink = navigationContent.includes('href="/login"');
  
  console.log('\nChecking navigation links:');
  console.log(`${hasHomeLink ? '✓' : '✗'} Navigation has link to Home page`);
  console.log(`${hasLoginLink ? '✓' : '✗'} Navigation has link to Login page`);
  
  // Check if Home page has link to Login page
  const homePageContent = fs.readFileSync(path.join(__dirname, 'src/app/page.tsx'), 'utf8');
  const homeHasLoginLink = homePageContent.includes('href="/login"');
  
  console.log('\nChecking Home page:');
  console.log(`${homeHasLoginLink ? '✓' : '✗'} Home page has link to Login page`);
  
  // Check if LoginForm component has form elements
  const loginFormContent = fs.readFileSync(path.join(__dirname, 'src/components/LoginForm.tsx'), 'utf8');
  const hasEmailInput = loginFormContent.includes('type="email"');
  const hasPasswordInput = loginFormContent.includes('type="password"') || 
                          (loginFormContent.includes('type={showPassword ? "text" : "password"}'));
  const hasSubmitButton = loginFormContent.includes('type="submit"');
  
  console.log('\nChecking Login form:');
  console.log(`${hasEmailInput ? '✓' : '✗'} Login form has email input`);
  console.log(`${hasPasswordInput ? '✓' : '✗'} Login form has password input`);
  console.log(`${hasSubmitButton ? '✓' : '✗'} Login form has submit button`);
  
  // Check if form validation is implemented
  const hasFormValidation = loginFormContent.includes('validateForm') || 
                           (loginFormContent.includes('errors') && 
                            loginFormContent.includes('setErrors'));
  
  console.log(`${hasFormValidation ? '✓' : '✗'} Login form has form validation`);
  
  // Check if form submission handler is implemented
  const hasFormSubmission = loginFormContent.includes('handleSubmit') || 
                           loginFormContent.includes('onSubmit');
  
  console.log(`${hasFormSubmission ? '✓' : '✗'} Login form has form submission handler`);
  
  // Overall test result
  const allTestsPassed = hasHomeLink && hasLoginLink && homeHasLoginLink && 
                        hasEmailInput && hasPasswordInput && hasSubmitButton && 
                        hasFormValidation && hasFormSubmission;
  
  console.log('\n' + '-'.repeat(50));
  if (allTestsPassed) {
    console.log('✅ All tests passed! The application has proper navigation between Home and Login pages.');
    console.log('✅ The Login form has all required elements and functionality.');
  } else {
    console.log('❌ Some tests failed. Please check the issues above.');
  }
  console.log('-'.repeat(50));
} else {
  console.log('\n❌ Some required files are missing. Please check the issues above.');
}
