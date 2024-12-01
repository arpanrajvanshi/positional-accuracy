// App.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './MapComponent';
import './App.css';

function App() {
  const [meanPositionalUncertainty, setMeanPositionalUncertainty] = useState(null);
  const [standardDeviation, setStandardDeviation] = useState(null);
  const [ce90, setCe90] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [points, setPoints] = useState([]);
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [entries, setEntries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [excludeOutliers, setExcludeOutliers] = useState(false);
  const [metrics, setMetrics] = useState({});

  const uploadFiles = async () => {
    if (!file1 || !file2) {
      alert('Please select both measured and reference points files.');
      return;
    }

    const formData = new FormData();
    formData.append('files', file1);
    formData.append('files', file2);

    try {
      const response = await axios.post('http://localhost:3000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Handle server errors
      if (response.data.error) {
        alert(response.data.error);
        return;
      }

      const createdAtDate = new Date(response.data.createdAt);
      setPoints(response.data.points);
      setCreatedAt(createdAtDate);

      // Set metrics (initially with all points)
      setMetrics({
        meanPositionalUncertainty: response.data.allMetrics.mean,
        standardDeviation: response.data.allMetrics.stdDev,
        ce90: response.data.allMetrics.ce90,
        meanPositionalUncertaintyNoOutliers: response.data.nonOutlierMetrics.mean,
        standardDeviationNoOutliers: response.data.nonOutlierMetrics.stdDev,
        ce90NoOutliers: response.data.nonOutlierMetrics.ce90,
      });

      // Initially set metrics including all points
      setMeanPositionalUncertainty(response.data.allMetrics.mean);
      setStandardDeviation(response.data.allMetrics.stdDev);
      setCe90(response.data.allMetrics.ce90);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files. Please check the server.');
    }
  };

  // Function to fetch entries from the database
  const fetchEntries = async (page = 1) => {
    try {
      const response = await axios.get(`http://localhost:3000/getEntries?page=${page}`);
      setEntries(response.data.entries);
      setCurrentPage(response.data.currentPage);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Error fetching entries:', error);
      alert('Error fetching entries from the database.');
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Function to open modal with data
  const openModal = async (entry) => {
    try {
      const response = await axios.get(`http://localhost:3000/getPoints/${entry.id}`);
      const points = response.data;

      setModalData({
        points,
        meanPositionalUncertainty: excludeOutliers
          ? entry.mean_positional_uncertainty_no_outliers
          : entry.mean_positional_uncertainty,
        standardDeviation: excludeOutliers
          ? entry.standard_deviation_no_outliers
          : entry.standard_deviation,
        ce90: excludeOutliers ? entry.ce90_no_outliers : entry.ce90,
        createdAt: new Date(entry.created_at),
        file1Name: entry.file1_name,
        file2Name: entry.file2_name,
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error fetching points:', error);
      alert('Error fetching points from the database.');
    }
  };

  // Function to save data to database
  const saveData = async () => {
    try {
      await axios.post('http://localhost:3000/save', {
        file1Name: file1.name,
        file2Name: file2.name,
        createdAt,
        allMetrics: {
          mean: metrics.meanPositionalUncertainty,
          stdDev: metrics.standardDeviation,
          ce90: metrics.ce90,
        },
        nonOutlierMetrics: {
          mean: metrics.meanPositionalUncertaintyNoOutliers,
          stdDev: metrics.standardDeviationNoOutliers,
          ce90: metrics.ce90NoOutliers,
        },
        points,
      });

      alert('Data saved to database successfully.');

      // After saving, fetch the entries again to update the grid
      fetchEntries();
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Error saving data to the database.');
    }
  };

  // Function to download data
  const downloadData = async () => {
    try {
      const response = await axios.get('http://localhost:3000/download', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'accuracy_data.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading data. Please check the server.');
    }
  };

  // Function to calculate error parameters based on inclusion/exclusion of outliers
  const calculateErrorParameters = () => {
    if (excludeOutliers) {
      setMeanPositionalUncertainty(metrics.meanPositionalUncertaintyNoOutliers);
      setStandardDeviation(metrics.standardDeviationNoOutliers);
      setCe90(metrics.ce90NoOutliers);
    } else {
      setMeanPositionalUncertainty(metrics.meanPositionalUncertainty);
      setStandardDeviation(metrics.standardDeviation);
      setCe90(metrics.ce90);
    }
  };

  // Update metrics when excludeOutliers changes
  useEffect(() => {
    calculateErrorParameters();
  }, [excludeOutliers]);

  // Parse and validate points to ensure they are correctly formatted as numbers
  const measuredPoints = points
    .map((point) => ({
      position: [parseFloat(point.lat1), parseFloat(point.lon1)],
      isOutlier: point.is_outlier,
    }))
    .filter((point) => !isNaN(point.position[0]) && !isNaN(point.position[1]));

    const referencePoints = points
    .map((point) => ({
      position: [parseFloat(point.lat2), parseFloat(point.lon2)],
      isOutlier: point.is_outlier,
    }))
    .filter((point) => !isNaN(point.position[0]) && !isNaN(point.position[1]));

  return (
    <div className="App">
      <h1>Absolute Positional Accuracy Measurement Tool</h1>

      <div className="main-content">
        <div className="left-panel">
          {/* File input for Measured Points */}
          <div className="file-input-container">
            <label htmlFor="file1">Measured Points File:</label>
            <input
              id="file1"
              type="file"
              onChange={(e) => setFile1(e.target.files[0])}
            />
            <span className="file-name">{file1 ? file1.name : 'No file chosen'}</span>
          </div>

          {/* File input for Reference Points */}
          <div className="file-input-container">
            <label htmlFor="file2">Reference Points File:</label>
            <input
              id="file2"
              type="file"
              onChange={(e) => setFile2(e.target.files[0])}
            />
            <span className="file-name">{file2 ? file2.name : 'No file chosen'}</span>
          </div>

          <button className="upload-button" onClick={uploadFiles}>
            Upload Files
          </button>

          {/* Buttons to exclude outliers */}
          {points.length > 0 && (
            <div className="button-group">
              <button onClick={() => setExcludeOutliers(!excludeOutliers)}>
                {excludeOutliers ? 'Include Outliers' : 'Exclude Outliers'}
              </button>
            </div>
          )}

          {/* Display the mean positional uncertainty, standard deviation, CE90, and ratio */}
          {meanPositionalUncertainty != null && standardDeviation != null && ce90 != null && (
            <div className="metrics-display">
              <h3>Results:</h3>
              <p>
                Mean Positional Uncertainty: {meanPositionalUncertainty?.toFixed(6) ?? 'N/A'} m
              </p>
              <p>
                Standard Deviation: {standardDeviation?.toFixed(6) ?? 'N/A'} m
              </p>
              <p>CE90: {ce90?.toFixed(6) ?? 'N/A'} m</p>
              <p>
                Ratio of Mean Positional Uncertainty to Standard Deviation:{' '}
                {standardDeviation !== 0 && standardDeviation != null
                  ? (meanPositionalUncertainty / standardDeviation).toFixed(6)
                  : 'N/A'}
              </p>
              <button className="save-button" onClick={saveData}>
                Save Results
              </button>
            </div>
          )}
        </div>

        {points.length > 0 && (
          <div className="right-panel">
            <div className="map-container">
              <MapComponent
                measuredPoints={measuredPoints}
                referencePoints={referencePoints}
                ce90={ce90}
                excludeOutliers={excludeOutliers}
              />
              <div className="legend">
                <h3>Legend</h3>
                <div className="legend-item">
                  <span className="legend-color red"></span>
                  <span>Measured Points</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color green"></span>
                  <span>Reference Points</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color black"></span>
                  <span>Outlier Points</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color blue-circle"></span>
                  <span>CE90 Circle</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <h2>Uploaded Entries</h2>
      {entries.length > 0 ? (
        <div className="file-grid">
          <table>
            <thead>
              <tr>
                <th>Measured Points File</th>
                <th>Reference Points File</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.id}>
                  <td>{entry.file1_name}</td>
                  <td>{entry.file2_name}</td>
                  <td>{new Date(entry.created_at).toLocaleString()}</td>
                  <td>
                    <button onClick={() => openModal(entry)}>👁️ View</button>
                    <button onClick={downloadData}>Download Data</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination Controls */}
          <div className="pagination">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  fetchEntries(currentPage - 1);
                }
              }}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => {
                if (currentPage < totalPages) {
                  fetchEntries(currentPage + 1);
                }
              }}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <p>No entries found.</p>
      )}

      {/* Modal for viewing data */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setShowModal(false)}>
              &times;
            </span>
            <h2>Data Preview</h2>
            <p>Measured Points File: {modalData.file1Name}</p>
            <p>Reference Points File: {modalData.file2Name}</p>
            <p>Created At: {new Date(modalData.createdAt).toLocaleString()}</p>
            <p>
              Mean Positional Uncertainty:{' '}
              {modalData.meanPositionalUncertainty != null
                ? modalData.meanPositionalUncertainty.toFixed(6)
                : 'N/A'}{' '}
              m
            </p>
            <p>
              Standard Deviation:{' '}
              {modalData.standardDeviation != null
                ? modalData.standardDeviation.toFixed(6)
                : 'N/A'}{' '}
              m
            </p>
            <p>
              CE90:{' '}
              {modalData.ce90 != null ? modalData.ce90.toFixed(6) : 'N/A'} m
            </p>
            <p>
              Ratio of Mean Positional Uncertainty to Standard Deviation:{' '}
              {modalData.standardDeviation && modalData.standardDeviation !== 0
                ? (modalData.meanPositionalUncertainty / modalData.standardDeviation).toFixed(6)
                : 'N/A'}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Measured Latitude</th>
                  <th>Measured Longitude</th>
                  <th>Reference Latitude</th>
                  <th>Reference Longitude</th>
                  <th>Distance (m)</th>
                </tr>
              </thead>
              <tbody>
                {modalData.points &&
                  modalData.points.map((row, index) => (
                    <tr
                      key={index}
                      style={{
                        backgroundColor: row.is_outlier ? 'yellow' : 'transparent',
                      }}
                    >
                      <td>{row.lat1}</td>
                      <td>{row.lon1}</td>
                      <td>{row.lat2}</td>
                      <td>{row.lon2}</td>
                      <td>{row.distance?.toFixed(6) ?? 'N/A'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
