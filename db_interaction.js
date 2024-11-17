// db.js
const pool = require('./dbConnection'); // Assuming you're using PostgreSQL

const getPointsData = async () => {
  const query = 'SELECT * FROM points_table'; // Adjust based on your table
  const { rows } = await pool.query(query);
  return rows;
};

module.exports = {
  getPointsData,
};
