// controllers/groupController.js (Updated with new function)
const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense'); // <-- NEW: Import Expense model
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Now you can define the cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- Existing functions (कोई बदलाव नहीं) ---
const createGroup = async (req, res) => {
  const { name, memberIds } = req.body;
  const adminId = req.user._id;

  try {
    const allMemberIds = new Set(memberIds);
    allMemberIds.add(adminId);
    
    const validMembers = await User.find({
      _id: { $in: Array.from(allMemberIds) },
    });

    const newGroup = new Group({
      name,
      admin: adminId,
      members: validMembers.map(member => member._id),
    });

    await newGroup.save();
    res.status(201).json({
      message: 'Group created successfully',
      group: newGroup,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
  
const getMyGroups = async (req, res) => {
  const userId = req.user._id;

  try {
    // Corrected populate method to include 'avatarUrl'
    const groups = await Group.find({ members: userId })
      .populate('members', 'name avatarUrl')
      .populate('admin', 'name'); 
    
    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addMemberToGroup = async (req, res) => {
  const { id } = req.params;
  const { memberId } = req.body;

  try {
    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const userToAdd = await User.findOne({ memberId });
    if (!userToAdd) {
      return res.status(404).json({ message: 'User not found with that member ID' });
    }
    
    if (group.members.includes(userToAdd._id)) {
      return res.status(400).json({ message: 'Member already in group' });
    }

    group.members.push(userToAdd._id);
    await group.save();

    res.status(200).json({
      message: 'Member added successfully',
      group,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const setGroupBackground = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user._id;

  try {
    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }
    
    // Check if the logged-in user is the admin of the group
    if (group.admin.toString() !== adminId.toString()) {
      return res.status(403).json({ message: 'Only the group admin can set the background.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    // Convert the buffer to a base64 string
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload the image to Cloudinary
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'group-backgrounds',
      resource_type: 'image'
    });

    const imageUrl = result.secure_url;
    
    group.backgroundImageUrl = imageUrl;
    await group.save();

    res.status(200).json({
      message: 'Group background updated successfully.',
      backgroundImageUrl: group.backgroundImageUrl,
    });

  } catch (error) {
    console.error('Error setting group background:', error);
    res.status(500).json({ message: 'Failed to set group background. Please try again.' });
  }
};

// --- NEW FUNCTION: Remove Member From Group ---
const removeMemberFromGroup = async (req, res) => {
  const { id } = req.params; // Group ID
  const { memberId } = req.body; // Member's _id to be removed
  const adminId = req.user._id;
console.log(`Removing member ${memberId} from group ${id} by admin ${adminId}`);
  try {
    const group = await Group.findById(id);

    // 1. Check if the group exists
    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    // 2. Check if the logged-in user is the admin
    if (group.admin.toString() !== adminId.toString()) {
      
      console.log(group.admin.toString() + ' is not the same as ' + adminId.toString());
      
      return res.status(403).json({ message: 'Only the group admin can remove members.' });
    }

    // 3. Check if the member to be removed exists in the group
    if (!group.members.includes(memberId)) {
      return res.status(404).json({ message: 'Member not found in this group.' });
    }

    // 4. Remove the member from the group's members array
    await Group.findByIdAndUpdate(
      id,
      { $pull: { members: memberId } },
      { new: true } // Return the updated document
    );

    res.status(200).json({
      message: 'Member removed successfully.',
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ message: 'Failed to remove member. Please try again.' });
  }
};

// --- NEW FUNCTION: Delete a Group and its Expenses ---
const deleteGroup = async (req, res) => {
  const { id } = req.params; // Group ID
  const adminId = req.user._id;

  try {
    // 1. Find the group and ensure the logged-in user is the admin
    const group = await Group.findOne({ _id: id, admin: adminId });
    
    // If no group is found, it means either the group doesn't exist or the user is not the admin.
    if (!group) {
      return res.status(404).json({ message: 'Group not found or you do not have permission to delete it.' });
    }

    // 2. Delete all expenses associated with this group
    await Expense.deleteMany({ group: id });

    // 3. Delete the group itself
    await Group.findByIdAndDelete(id);

    res.status(200).json({ message: 'Group and all associated expenses deleted successfully.' });

  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ message: 'Failed to delete group. Please try again.' });
  }
};

// --- Export all functions, including the new one ---
module.exports = {
  createGroup,
  getMyGroups,
  addMemberToGroup,
  setGroupBackground,
  removeMemberFromGroup,
  deleteGroup, // <-- NEW
};