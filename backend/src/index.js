// const express = require('express');
const app = express();
// const PORT = process.env.PORT || 3001;
const PORT = process.env.PORT || 4000;
import "dotenv/config"
import express from "express"
import cors from "cors"
import morgan from "morgan"
import { createClient } from "@supabase/supabase-js"
import tasksRouter from "./routes/tasks.js"  


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

app.use(cors({ origin: "http://localhost:3000" })) 
app.use(express.json());
app.use(morgan("dev"))
app.use("/tasks", tasksRouter)


app.get('/', (req, res) => {
  res.send('Backend is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
