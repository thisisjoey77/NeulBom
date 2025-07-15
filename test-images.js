// Test script to check image paths
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('=== Image Path Test ===');
console.log('Current directory:', __dirname);
console.log('App is packaged:', app?.isPackaged || false);

// Test image files
const testImages = ['강아지.png', '고양이.png', '나비.jpg'];

testImages.forEach(imageName => {
  const imagePath = path.join(__dirname, 'images', imageName);
  console.log(`\nTesting: ${imageName}`);
  console.log(`Path: ${imagePath}`);
  console.log(`Exists: ${fs.existsSync(imagePath)}`);
  
  if (fs.existsSync(imagePath)) {
    const fileUrl = `file://${imagePath.replace(/\\/g, '/')}`;
    console.log(`File URL: ${fileUrl}`);
  }
});

console.log('\n=== Images directory listing ===');
const imagesDir = path.join(__dirname, 'images');
if (fs.existsSync(imagesDir)) {
  const files = fs.readdirSync(imagesDir);
  console.log('Files found:', files);
} else {
  console.log('Images directory not found');
}
