const { spawn } = require('child_process');
const fetch = require('node-fetch');

module.exports = async () => {
  console.log('Setting up test environment...');
  
  // Install dependencies if needed
  return new Promise((resolve) => {
    const install = spawn('npm', ['install'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    install.on('close', (code) => {
      if (code === 0) {
        console.log('Dependencies installed successfully');
      } else {
        console.warn('Warning: npm install failed, continuing with tests');
      }
      resolve();
    });
    
    install.on('error', (error) => {
      console.warn('Warning: npm install error:', error.message);
      resolve(); // Continue with tests anyway
    });
  });
};