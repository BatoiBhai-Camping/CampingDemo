import mongoose from "mongoose";
import { Schema } from "mongoose";

const walletSchema = new Schema({
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    balance: { type: Number, default: 0 }, // Wallet balance in USD 
    transactions: [
        {
            amount: Number,
            type: { type: String, enum: ["credit", "debit"] }, // credit for adding, debit for withdrawal
            date: { type: Date, default: Date.now },
            reference: String, // Transaction reference (payment ID, etc.)
        },
    ],
});

const Wallet = mongoose.model("Wallet", walletSchema);
export default Wallet;
