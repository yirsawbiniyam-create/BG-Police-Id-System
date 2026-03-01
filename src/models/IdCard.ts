import mongoose from "mongoose";

const IdCardSchema = new mongoose.Schema({
  cardCode: { type: String, unique: true },
  fullNameAm: String,
  fullNameEn: String,
  rankAm: String,
  rankEn: String,
  responsibilityAm: String,
  responsibilityEn: String,
  badgeNumber: String,
  bloodType: String,
  gender: String,
  height: String,
  phone: String,
  emergencyContact: {
    name: String,
    phone: String
  },
  status: { type: String, default: "active" },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("IdCard", IdCardSchema);
