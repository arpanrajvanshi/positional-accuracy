const express = require('express');
const router = express.Router();
const db = require('./db'); // Assuming you have a database connection file
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');

// This route will handle downloading the data in CSV format
router.get('/download', async (req, res) => {
  try {
    // Fetch data from database (assume you have a function to get the data)
    const data = await db.getPointsData(); // Replace this with your actual data-fetching logic

    // Path to save the CSV file temporarily
    const filePath = path.join(__dirname, 'data.csv');

    // Create a CSV writer
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'x', title: 'X Coordinate' },
        { id: 'y', title: 'Y Coordinate' },
        { id: 'error', title: 'Error' }, // Example fields
      ],
    });

    // Write data to CSV
    await csvWriter.writeRecords(data);

    // Send the file for download
    res.download(filePath, 'data.csv', (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Could not download the file.');
      }

      // Delete the file after sending to clean up
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error('Error fetching data or generating CSV:', error);
    res.status(500).send('Server error');
  }
});

module.exports = router;
