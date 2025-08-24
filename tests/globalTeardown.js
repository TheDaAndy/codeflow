module.exports = async () => {
  console.log('Cleaning up test environment...');
  
  // Kill any remaining processes
  const { exec } = require('child_process');
  
  return new Promise((resolve) => {
    // Kill any remaining Electron processes
    exec('pkill -f electron || true', (error) => {
      if (error) {
        console.log('No Electron processes to kill');
      }
      
      // Kill any remaining Node processes on test ports
      exec('lsof -ti:3001,3002 | xargs kill -9 || true', (error) => {
        if (error) {
          console.log('No processes running on test ports');
        }
        
        console.log('Test environment cleaned up');
        resolve();
      });
    });
  });
};