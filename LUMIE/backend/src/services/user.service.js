/**
 * src/services/user.service.js - Business Logic cho User Management
 */

const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Chọn các trường user an toàn (không có password_hash)
 */
const userSelectFields = {
  id: true,
  full_name: true,
  email: true,
  phone: true,
  status: true,
  must_change_password: true,
  last_login: true,
  created_at: true,
  updated_at: true,
  role: {
    select: { id: true, role_name: true },
  },
  warehouse: {
    select: { id: true, warehouse_name: true, warehouse_code: true },
  },
};

/**
 * Lấy danh sách nhân viên với tìm kiếm và phân trang
 */
const getUsers = async ({ page = 1, limit = 10, search = '', status = '' }) => {
  const skip = (page - 1) * limit;

  // Điều kiện tìm kiếm
  const where = {
    deleted_at: null,
    // Chỉ lấy nhân viên kho (không hiện Quản lý kho trong danh sách nhân viên)
    role: { role_name: 'WAREHOUSE_STAFF' },
    ...(search && {
      OR: [
        { full_name: { contains: search } },
        { email: { contains: search } },
      ],
    }),
    ...(status && { status: status }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelectFields,
      orderBy: { created_at: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
};

/**
 * Lấy thông tin chi tiết một user
 */
const getUserById = async (id) => {
  return await prisma.user.findUnique({
    where: { id: parseInt(id), deleted_at: null },
    select: userSelectFields,
  });
};

/**
 * Tạo tài khoản nhân viên mới
 * Role luôn là WAREHOUSE_STAFF - không thể tùy chỉnh từ client
 */
const createUser = async ({ full_name, email, password, phone, warehouse_id }, actorId, ipAddress) => {
  // Kiểm tra email đã tồn tại chưa
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { success: false, message: 'Email đã được sử dụng bởi tài khoản khác' };
  }

  // Tìm role WAREHOUSE_STAFF
  const staffRole = await prisma.role.findUnique({ where: { role_name: 'WAREHOUSE_STAFF' } });
  if (!staffRole) {
    throw new Error('Không tìm thấy vai trò WAREHOUSE_STAFF trong hệ thống');
  }

  // Hash mật khẩu
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Tạo user
  const newUser = await prisma.user.create({
    data: {
      full_name,
      email,
      password_hash,
      phone,
      role_id: staffRole.id, // QUAN TRỌNG: Luôn là WAREHOUSE_STAFF
      warehouse_id: warehouse_id ? parseInt(warehouse_id) : null,
      status: 'ACTIVE',
      must_change_password: true, // Yêu cầu đổi mật khẩu lần đầu
    },
    select: userSelectFields,
  });

  // Ghi audit log
  await prisma.auditLog.create({
    data: {
      user_id: actorId,
      action: 'CREATE_USER',
      description: `Tạo tài khoản nhân viên: ${email}`,
      target_id: newUser.id,
      target_type: 'user',
      ip_address: ipAddress,
    },
  });

  return { success: true, data: newUser };
};

/**
 * Cập nhật thông tin nhân viên
 * Không cho phép sửa role hoặc email
 */
const updateUser = async (id, updateData, actorId, ipAddress) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(id), deleted_at: null },
  });

  if (!user) {
    return { success: false, message: 'Không tìm thấy nhân viên' };
  }

  // Chỉ cho phép cập nhật các trường được phép
  const allowedFields = ['full_name', 'phone', 'warehouse_id'];
  const dataToUpdate = {};
  
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      dataToUpdate[field] = field === 'warehouse_id' 
        ? (updateData[field] ? parseInt(updateData[field]) : null)
        : updateData[field];
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: parseInt(id) },
    data: dataToUpdate,
    select: userSelectFields,
  });

  // Ghi audit log
  await prisma.auditLog.create({
    data: {
      user_id: actorId,
      action: 'UPDATE_USER',
      description: `Cập nhật thông tin nhân viên ID: ${id}`,
      target_id: parseInt(id),
      target_type: 'user',
      ip_address: ipAddress,
    },
  });

  return { success: true, data: updatedUser };
};

/**
 * Thay đổi trạng thái tài khoản (ACTIVE/INACTIVE)
 * Không xóa vật lý - chỉ chuyển status
 */
const updateUserStatus = async (id, status, actorId, ipAddress) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(id), deleted_at: null },
    include: { role: true },
  });

  if (!user) {
    return { success: false, message: 'Không tìm thấy nhân viên' };
  }

  // Không cho phép vô hiệu hóa Quản lý kho qua API này
  if (user.role.role_name === 'WAREHOUSE_MANAGER') {
    return { success: false, message: 'Không thể thay đổi trạng thái tài khoản Quản lý kho' };
  }

  // Không cho phép sửa trạng thái của chính mình
  if (parseInt(id) === actorId) {
    return { success: false, message: 'Không thể thay đổi trạng thái tài khoản của chính mình' };
  }

  await prisma.user.update({
    where: { id: parseInt(id) },
    data: { status },
  });

  // Nếu vô hiệu hóa, thu hồi toàn bộ refresh token của user đó
  if (status === 'INACTIVE') {
    await prisma.refreshToken.updateMany({
      where: { user_id: parseInt(id), revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  // Ghi audit log
  await prisma.auditLog.create({
    data: {
      user_id: actorId,
      action: status === 'INACTIVE' ? 'DISABLE_USER' : 'ENABLE_USER',
      description: `${status === 'INACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'} tài khoản nhân viên ID: ${id}`,
      target_id: parseInt(id),
      target_type: 'user',
      ip_address: ipAddress,
    },
  });

  return {
    success: true,
    message: status === 'INACTIVE' 
      ? 'Đã vô hiệu hóa tài khoản nhân viên' 
      : 'Đã kích hoạt tài khoản nhân viên',
  };
};

/**
 * Đặt lại mật khẩu nhân viên (Quản lý thực hiện)
 */
const resetUserPassword = async (id, newPassword, actorId, ipAddress) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(id), deleted_at: null },
  });

  if (!user) {
    return { success: false, message: 'Không tìm thấy nhân viên' };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: parseInt(id) },
    data: {
      password_hash: newPasswordHash,
      must_change_password: true, // Yêu cầu đổi mật khẩu khi đăng nhập lại
      failed_login_attempts: 0,
      locked_until: null,
    },
  });

  // Thu hồi toàn bộ refresh token cũ
  await prisma.refreshToken.updateMany({
    where: { user_id: parseInt(id), revoked_at: null },
    data: { revoked_at: new Date() },
  });

  // Ghi audit log
  await prisma.auditLog.create({
    data: {
      user_id: actorId,
      action: 'RESET_PASSWORD',
      description: `Đặt lại mật khẩu cho nhân viên ID: ${id}`,
      target_id: parseInt(id),
      target_type: 'user',
      ip_address: ipAddress,
    },
  });

  return { success: true, message: 'Đặt lại mật khẩu thành công' };
};

/**
 * Xóa nhân viên (Soft delete - đánh dấu deleted_at và chuyển trạng thái INACTIVE)
 */
const deleteUser = async (id, actorId, ipAddress) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(id), deleted_at: null },
    include: { role: true },
  });

  if (!user) {
    return { success: false, message: 'Không tìm thấy nhân viên' };
  }

  // Không cho phép xóa Quản lý kho
  if (user.role.role_name === 'WAREHOUSE_MANAGER') {
    return { success: false, message: 'Không thể xóa tài khoản Quản lý kho' };
  }

  // Không cho phép tự xóa chính mình
  if (parseInt(id) === actorId) {
    return { success: false, message: 'Không thể tự xóa tài khoản của chính mình' };
  }

  // Soft delete: cập nhật deleted_at và status
  await prisma.user.update({
    where: { id: parseInt(id) },
    data: {
      deleted_at: new Date(),
      status: 'INACTIVE',
    },
  });

  // Thu hồi toàn bộ refresh token để buộc logout ngay lập tức
  await prisma.refreshToken.updateMany({
    where: { user_id: parseInt(id), revoked_at: null },
    data: { revoked_at: new Date() },
  });

  // Ghi audit log
  await prisma.auditLog.create({
    data: {
      user_id: actorId,
      action: 'DELETE_USER',
      description: `Xóa tài khoản nhân viên: ${user.full_name} (${user.email})`,
      target_id: parseInt(id),
      target_type: 'user',
      ip_address: ipAddress,
    },
  });

  return { success: true, message: 'Xóa nhân viên thành công' };
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
};
