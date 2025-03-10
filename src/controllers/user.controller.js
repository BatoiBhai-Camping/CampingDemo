import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/notificationService.js";

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



  const { username, email, fullname, password, phone, address, role } = req.body;



  if (
    [fullname, email, username, password,phone, address, role].some((field) =>

      field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required")
  }


  const existedUser = await User.findOne({
    $or: [{ username }, { email },{phone}]
  })

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists")
  }

  const profileImageLocalPath = req.files?.profileImage[0]?.path;

 

console.log(fullname, email, username, password,phone, address, role);


  if (!profileImageLocalPath) {
    throw new ApiError(400, "Avatar file is rquired");
  }

  const avatar = await uploadOnCloudinary(profileImageLocalPath)
 

  if (!avatar) {
    throw new ApiError(400, "Avatar file is rquired");
  }

  const user = await User.create({
    fullname,
    profileImage: avatar.url,
   
    email,
    password,
    phone,
    address, 
    role,
    status:"pending",
    username: username.toLowerCase()
  })

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )
  if (!createdUser) {
    throw new ApiError(500, "something went wrong while creating user")
  }

  const mailData={
    'name':createdUser.fullname,
    'loginLink':"https://cspcb.netlify.app",
    'year':2025,
    'companyLogo':"https://res.cloudinary.com/codebysidd/image/upload/v1739714720/cropped-20231015_222433_nj7ul2.png"


  }
   sendEmail(createdUser.email,"Account creation","account-creation" , mailData);

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






export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails,updateUserAvatar }