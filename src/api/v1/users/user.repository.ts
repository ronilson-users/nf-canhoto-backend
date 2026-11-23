import { User, IUser } from "./user.model";
import { AppError } from "@/shared/utils/error";

export class UserRepository {
  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return await user.save();
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({ isActive: true })
        .select("-password -__v") // also exclude __v
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(), // performance boost when you don't need full Mongoose documents
      User.countDocuments({ isActive: true }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<IUser | null> {
    if (!id) throw new AppError("User ID is required", 400);
    return await User.findById(id)
      .select("-password -__v")
      .lean();
  }

  async findByEmail(email: string): Promise<IUser | null> {
    if (!email) throw new AppError("Email is required", 400);
    return await User.findOne({ email }).select("+password -__v");
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    if (!id) throw new AppError("User ID is required", 400);

    const { password, ...updateData } = data;

    // Prevent accidental password update through this method
    if (password) {
      console.warn(`Password update attempted via UserRepository.update for id: ${id}`);
      // You could throw here if you want to be strict
    }

    return await User.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() }, // ensure updatedAt is set
      { new: true, runValidators: true }
    )
      .select("-password -__v")
      .lean();
  }

  async delete(id: string): Promise<IUser | null> {
    if (!id) throw new AppError("User ID is required", 400);

    return await User.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    )
      .select("-password -__v")
      .lean();
  }

  async hardDelete(id: string): Promise<IUser | null> {
    if (!id) throw new AppError("User ID is required", 400);
    return await User.findByIdAndDelete(id);
  }

  // Optional: Restore soft-deleted user
  async restore(id: string): Promise<IUser | null> {
    return await User.findByIdAndUpdate(
      id,
      { isActive: true, updatedAt: new Date() },
      { new: true }
    )
      .select("-password -__v")
      .lean();
  }
}