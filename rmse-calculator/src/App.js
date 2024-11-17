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
      setMeanPositionalUncertainty(response.data.meanPositionalUncertainty);
      setStandardDeviation(response.data.standardDeviation);
      setCe90(response.data.ce90);
      setPoints(response.data.points);
      setCreatedAt(createdAtDate);
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
        meanPositionalUncertainty: entry.mean_positional_uncertainty,
        standardDeviation: entry.standard_deviation,
        ce90: entry.ce90,
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
        meanPositionalUncertainty,
        standardDeviation,
        ce90,
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

  // Parse and validate points to ensure they are correctly formatted as numbers
  const measuredPoints = points
    .map((point) => [parseFloat(point.lat1), parseFloat(point.lon1)])
    .filter(([lat, lon]) => !isNaN(lat) && !isNaN(lon));

  const referencePoints = points
    .map((point) => [parseFloat(point.lat2), parseFloat(point.lon2)])
    .filter(([lat, lon]) => !isNaN(lat) && !isNaN(lon));

  return (
    <div className="App">
      <h1>Absolute Positional Accuracy Measurement Tool</h1>

      {/* File input for Measured Points */}
      <div className="file-input-container">
        <label htmlFor="file1">Choose Measured Points File</label>
        <input
          id="file1"
          type="file"
          onChange={(e) => setFile1(e.target.files[0])}
        />
        <span className="file-name">{file1 ? file1.name : 'No file chosen'}</span>
      </div>

      {/* File input for Reference Points */}
      <div className="file-input-container">
        <label htmlFor="file2">Choose Reference Points File</label>
        <input
          id="file2"
          type="file"
          onChange={(e) => setFile2(e.target.files[0])}
        />
        <span className="file-name">{file2 ? file2.name : 'No file chosen'}</span>
      </div>

      <button onClick={uploadFiles}>Calculate Mean Positional Uncertainty and CE90</button>

      {/* Display the mean positional uncertainty, standard deviation, CE90, and ratio */}
      {meanPositionalUncertainty !== null && (
        <div className="metrics-display">
          <p>Mean Positional Uncertainty: {meanPositionalUncertainty.toFixed(6)} m</p>
          <p>Standard Deviation: {standardDeviation.toFixed(6)} m</p>
          <p>CE90: {ce90.toFixed(6)} m</p>
          <p>
            Ratio of Mean Positional Uncertainty to Standard Deviation:{' '}
            {(meanPositionalUncertainty / standardDeviation).toFixed(6)}
          </p>
        </div>
      )}

      {points.length > 0 && (
        <div className="map-container">
          <MapComponent
            measuredPoints={measuredPoints}
            referencePoints={referencePoints}
          />
          <div className="legend">
            <h3>Legend</h3>
            <div className="legend-item">
              <span className="legend-color red"></span>
              <span>Measured Points (Red Markers)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color green"></span>
              <span>Reference Points (Green Markers)</span>
            </div>
          </div>
          <button onClick={saveData}>Save</button>
        </div>
      )}

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
              Mean Positional Uncertainty: {modalData.meanPositionalUncertainty.toFixed(6)} m
            </p>
            <p>Standard Deviation: {modalData.standardDeviation.toFixed(6)} m</p>
            <p>CE90: {modalData.ce90.toFixed(6)} m</p>
            <p>
              Ratio of Mean Positional Uncertainty to Standard Deviation:{' '}
              {(
                modalData.meanPositionalUncertainty / modalData.standardDeviation
              ).toFixed(6)}
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
                {modalData.points.map((row, index) => (
                  <tr key={index}>
                    <td>{row.lat1}</td>
                    <td>{row.lon1}</td>
                    <td>{row.lat2}</td>
                    <td>{row.lon2}</td>
                    <td>{row.distance.toFixed(6)}</td>
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
