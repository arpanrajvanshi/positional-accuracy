const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer'); // Import csv-writer
const app = express();

// PostgreSQL setup
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'accuracy1_db', 
  password: '6398', // Replace with your actual database password
  port: 5432,
});

client.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected');
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/build')));

const upload = multer({ dest: 'uploads/' });

// Function to calculate distance between two lat/long points using the Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180; // Convert latitude to radians
  const φ2 = (lat2 * Math.PI) / 180; // Convert latitude to radians
  const Δφ = ((lat2 - lat1) * Math.PI) / 180; // Difference in latitude
  const Δλ = ((lon2 - lon1) * Math.PI) / 180; // Difference in longitude

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters
  return distance;
};

// Calculate Mean Positional Uncertainty
const calculateMeanPositionalUncertainty = (errors) => {
  const sumOfErrors = errors.reduce((acc, error) => acc + error, 0);
  return sumOfErrors / errors.length;
};

// Calculate standard deviation
const calculateStandardDeviation = (errors, mean) => {
  const squaredDiffs = errors.map((error) => Math.pow(error - mean, 2));
  const variance = squaredDiffs.reduce((sum, value) => sum + value, 0) / (errors.length - 1);
  return Math.sqrt(variance);
};

// Determine k value based on the ratio of mean to standard deviation
const determineK = (ratio) => {
  if (ratio > 1.4) {
    return 1.2815;
  } else {
    return 1.6435 - (0.999556 * ratio) + (0.923237 * Math.pow(ratio, 2)) - (0.282533 * Math.pow(ratio, 3));
  }
};

// Calculate CE90
const calculateCE90 = (mean, standardDeviation) => {
  const ratio = Math.abs(mean) / standardDeviation;
  const k = determineK(ratio);
  return Math.abs(mean) + (k * standardDeviation);
};

// Calculate Absolute CE90
const calculateAbsoluteCE90 = (ce90Source, ce90Reference) => {
  return Math.sqrt(Math.pow(ce90Reference, 2) + Math.pow(ce90Source, 2));
};

// API to upload Excel files and calculate Mean Positional Uncertainty and CE90
app.post('/upload', upload.array('files', 2), async (req, res) => {
  try {
    console.log('Received files:', req.files);
    const files = req.files;
    if (files.length !== 2) {
      return res.status(400).json({ error: 'Please upload two Excel files.' });
    }

    const file1Path = files[0].path;
    const file2Path = files[1].path;

    const file1 = XLSX.readFile(file1Path);
    const file2 = XLSX.readFile(file2Path);

    const sheet1 = file1.Sheets[file1.SheetNames[0]];
    const sheet2 = file2.Sheets[file2.SheetNames[0]];

    const data1 = XLSX.utils.sheet_to_json(sheet1, { defval: '', raw: false });
    const data2 = XLSX.utils.sheet_to_json(sheet2, { defval: '', raw: false });

    const distances = [];
    const dataToSave = [];

    for (let i = 0; i < Math.min(data1.length, data2.length); i++) {
      const lat1 = parseFloat(data1[i]['Latitude'] || data1[i]['lat']);
      const lon1 = parseFloat(data1[i]['Longitude'] || data1[i]['lon']);
      const lat2 = parseFloat(data2[i]['Latitude'] || data2[i]['lat']);
      const lon2 = parseFloat(data2[i]['Longitude'] || data2[i]['lon']);

      if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
        const distance = calculateDistance(lat1, lon1, lat2, lon2);
        distances.push(distance);
        dataToSave.push({ lat1, lon1, lat2, lon2, distance });
      }
    }

    fs.unlinkSync(file1Path);
    fs.unlinkSync(file2Path);

    if (distances.length === 0) {
      return res.status(400).json({ error: 'No valid data found in the uploaded files.' });
    }

    const meanPositionalUncertainty = calculateMeanPositionalUncertainty(distances);
    const standardDeviation = calculateStandardDeviation(distances, meanPositionalUncertainty);
    const ratio = Math.abs(meanPositionalUncertainty) / standardDeviation;
    const ce90 = calculateCE90(meanPositionalUncertainty, standardDeviation);
    const ce90Reference = 0.001; // Placeholder value, replace with actual if available
    const ce90Abs = calculateAbsoluteCE90(ce90, ce90Reference);

    const createdAt = new Date().toISOString();

    res.json({
      meanPositionalUncertainty,
      standardDeviation,
      ratio,
      ce90,
      ce90Abs,
      points: dataToSave,
      createdAt,
    });
  } catch (error) {
    console.error('Error processing files:', error);
    res.status(500).json({ error: 'Server error while processing files.' });
  }
});

// Endpoint to save data to the database
app.post('/save', async (req, res) => {
  const {
    file1Name,
    file2Name,
    createdAt,
    meanPositionalUncertainty,
    standardDeviation,
    ce90,
    points,
  } = req.body;

  try {
    // Insert into entries table
    const insertEntryQuery = `
      INSERT INTO entries (file1_name, file2_name, created_at, mean_positional_uncertainty, standard_deviation, ce90)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const entryResult = await client.query(insertEntryQuery, [
      file1Name,
      file2Name,
      createdAt,
      meanPositionalUncertainty,
      standardDeviation,
      ce90,
    ]);
    const entryId = entryResult.rows[0].id;

    // Insert points into points table
    const insertPointQuery = `
      INSERT INTO points (entry_id, lat1, lon1, lat2, lon2, distance, index)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      await client.query(insertPointQuery, [
        entryId,
        point.lat1,
        point.lon1,
        point.lat2,
        point.lon2,
        point.distance,
        i + 1, // index
      ]);
    }

    res.status(200).json({ message: 'Data saved successfully.' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Failed to save data to the database.' });
  }
});

// Endpoint to get entries with pagination
app.get('/getEntries', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // default page 1
  const limit = 10;
  const offset = (page - 1) * limit;

  try {
    const totalEntriesResult = await client.query('SELECT COUNT(*) FROM entries');
    const totalEntries = parseInt(totalEntriesResult.rows[0].count);

    const getEntriesQuery = `
      SELECT * FROM entries
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const entriesResult = await client.query(getEntriesQuery, [limit, offset]);
    const entries = entriesResult.rows;

    res.json({
      totalEntries,
      totalPages: Math.ceil(totalEntries / limit),
      currentPage: page,
      entries,
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries from the database.' });
  }
});

// Endpoint to get points for an entry
app.get('/getPoints/:entryId', async (req, res) => {
  const entryId = parseInt(req.params.entryId);

  try {
    const getPointsQuery = `
      SELECT * FROM points WHERE entry_id = $1 ORDER BY index
    `;
    const pointsResult = await client.query(getPointsQuery, [entryId]);
    const points = pointsResult.rows;

    res.json(points);
  } catch (error) {
    console.error('Error fetching points:', error);
    res.status(500).json({ error: 'Failed to fetch points from the database.' });
  }
});

// Fetch stored data and generate a CSV file for download
// Fetch stored data and generate a CSV file for download
app.get('/download', async (req, res) => {
  try {
    const query = `
      SELECT p.*, e.file1_name, e.file2_name
      FROM points p
      INNER JOIN entries e ON p.entry_id = e.id
    `;
    const result = await client.query(query);

    const csvWriter = createObjectCsvWriter({
      path: 'accuracy_data.csv',
      header: [
        { id: 'file1_name', title: 'Measured File' },
        { id: 'file2_name', title: 'Reference File' },
        { id: 'lat1', title: 'Measured Latitude' },
        { id: 'lon1', title: 'Measured Longitude' },
        { id: 'lat2', title: 'Reference Latitude' },
        { id: 'lon2', title: 'Reference Longitude' },
        { id: 'distance', title: 'Distance (m)' },
        { id: 'index', title: 'Point Index' },
      ],
    });

    await csvWriter.writeRecords(result.rows);
    res.download(path.join(__dirname, 'accuracy_data.csv'), 'accuracy_data.csv', (err) => {
      if (err) console.error('Error while sending the file:', err);
      else fs.unlinkSync(path.join(__dirname, 'accuracy_data.csv'));
    });
  } catch (err) {
    console.error('Error while fetching or generating CSV:', err);
    res.status(500).send('Server error');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
