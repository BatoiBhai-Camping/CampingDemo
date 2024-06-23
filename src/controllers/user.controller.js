import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const genearteAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId)

    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }

  } catch (error) {
    throw new ApiError(500, "something went wrong while generating ")
  }
}

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  //validation
  //check if user already exists : username ,email
  //check for images,check for avatar
  //upload them to cloudinary,avatar
  //create user object - create entry in db
  //remove password and refresh token from response
  //check for user creation 
  //return res



  const { fullname, email, username, password } = req.body



  if (
    [fullname, email, username, password].some((field) =>

      field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required")
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  })

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists")
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  // const coverImageLocalPath = req.files?.coverImage[0].path;
  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path
  }



  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is rquired");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if (!avatar) {
    throw new ApiError(400, "Avatar file is rquired");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )
  if (!createdUser) {
    throw new ApiError(500, "something went wrong while creating user")
  }

  return res.status(201).json(
    new ApiResponse(200, createdUser, "user registered successfully ")
  )



}
)

const loginUser = asyncHandler(async (req, res) => {
  //req body -> data
  // usernameor email
  // find the user
  //password check
  //access and refresh token
  // send cookies

  const { email, username, password } = req.body
  if (!username && !email) {
    throw new ApiError(400, "username or email required")
  }

  const user = await User.findOne({
    $or: [{ email }, { username }]
  })

  if (!user) {
    throw new ApiError(404, "User does not exist")
  }


  const isPasswordValid = await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401, "Password incorrect")
  }
  const { accessToken, refreshToken } = await genearteAccessAndRefreshToken(user._id)
  const logedInUser = await User.findById(user._id).select("-password -refreshToken")
  const options = {
    httpOnly: true,
    secure: true
  }

  return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(
    new ApiResponse(200, { user: logedInUser, accessToken, refreshToken }, "User LoggedIn successfully")
  )

})

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(
    new ApiResponse(200, {}, "User loggedOut")
  )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
  if (!incommingRefreshToken) {
    throw new ApiError(401, "unauthorized request")
  }
  try {
    const decodedToken = await jwt.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    const user = await User.findById(decodedToken?._id)
    if (!user) {
      throw new ApiError(401, "invalid refreshToken")
    }

    if (incommingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, " refreshToken is expired or use ")
    }

    const options = {
      httpOnly: true,
      secure: true
    }

    const [accessToken, newRefreshToken] = await genearteAccessAndRefreshToken(user._id)
    return res.status(200).cookie("accessToken", accessToken).cookie("refreshToken", newRefreshToken).json(
      new ApiResponse(
        200,
        {
          accessToken,
          newRefreshToken
        },
        "AccessToken refreshed"

      )
    )

  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refreshToken")
  }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body
  const user = await User.findById(req.user?._id)
  const ispasswordCorrect = await user.isPasswordCorrect(oldPassword)
  if (!ispasswordCorrect) {
    throw new ApiError(400, "Invalid Old Password")
  }
  user.password = newPassword
  await user.save({ validateBeforeSave: false })

  return res.status(200)
    .json(new ApiResponse(new ApiResponse(200, {}, "Password Changed Successfully")))

})

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, " User fetched successfully"))
})

const updateAccountDetails = asyncHandler( async (req, res) => {
  const { fullname, email } = req.body

  if (!fullname || !email) {
    throw new ApiError(400, "All fields are required")
  }
  const user = await User.findByIdAndUpdate(req.uer?._id, {
    $set:{fullname: fullname,//or only write fullname 
   email: email
    }
  }, { new: true }).select("-password ")
  return res.status(200).json(new ApiResponse(200, user, "Account details update successfully"))
})




const updateUserAvatar = asyncHandler(async (req,res)=>{
 const avatarLocalPath = req.file?.path
 if(! avatarLocalPath){
  throw new ApiError(400,"Avatar file is missing")
 }
const avatar = await uploadOnCloudinary(avatarLocalPath)

if(!avatar.url){
  throw new ApiError(400,"Error while uploading on avatar ")
}

const user = await User.findByIdAndUpdate(req.uer?._id,{$set:{avatar:avatar.url}},{new:true}).select("-password")

return res.status(200).json(new ApiResponse(200,user,"Avatar  updated successfully"))


})


const updateUserCoverImage = asyncHandler(async (req,res)=>{
  const coverImageLocalPath = req.file?.path
  if(! coverImageLocalPath){
   throw new ApiError(400,"CoverImage file is missing")
  }
 const coverImage = await uploadOnCloudinary(coverImageLocalPath)
 
 if(!coverImage.url){
   throw new ApiError(400,"Error while uploading on coverImage ")
 }
 
 const user = await User.findByIdAndUpdate(req.uer?._id,{$set:{coverImage:coverImager.url}},{new:true}).select("-password")
 
 return res.status(200).json(new ApiResponse(200,user,"Cover image updated successfully"))
 
 
 })
 


export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails,updateUserAvatar ,updateUserCoverImage}