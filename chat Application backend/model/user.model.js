import mongoose, { Schema } from "mongoose";
import JWT from "jsonwebtoken";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    token: {
      type: String,
    },
  },
  { timestamps: true }
);

userSchema.methods.generateToken = async function () {
  return JWT.sign(
    {
      _id: this._id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
};

export const User = mongoose.model("User", userSchema);
