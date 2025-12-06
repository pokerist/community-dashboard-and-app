import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User, Role, Prisma } from '@prisma/client';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import * as bcrypt from 'bcrypt';

// Define a type for a User object that includes units and leases (or whatever you need)
type UserWithRelations = Prisma.UserGetPayload<{
  include: { 
    residentUnits: { include: { unit: true } }; // Ensure this matches your query
    leasesAsOwner: true;
    invoices: true;
  }
}>;

@Injectable()
export class ResidentService {
  constructor(private prisma: PrismaService) {}

  // POST /users: Create User (Admin action)
  async create(data: CreateResidentDto): Promise<User> {
    // 1. Destructure to extract 'password' and put everything else into 'restOfData'
    const { password, ...restOfData } = data;

    let passwordHash: string | undefined;

    // 2. Hash the password if provided
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    return this.prisma.user.create({
      data: {
        ...restOfData, // <-- Only the fields that exist in the DB model
        passwordHash,    // <-- The computed, hashed field
        userStatus: 'ACTIVE', 
        origin: 'dashboard',
      },
    });
  }

  // GET /users: List Users (with basic pagination/filtering)
  async findAll(role?: Role, skip: number = 0, take: number = 20): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        role: role, // Filters if role is provided
        userStatus: 'ACTIVE' // Only list active users by default
      },
      skip, 
      take,
      orderBy: { nameEN: 'asc' },
    });
  }

  // GET /users/:id: Get User Profile
async findOne(id: string): Promise<UserWithRelations> { // <-- Use the new type here
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { 
          residentUnits: { 
              include: { unit: true } // You had `units` here, but schema uses `residentUnits`
          }, 
          leasesAsOwner: true, 
          invoices: true,
          // Add other relationships you want to access later
      },
    });
    
    if (!user) throw new NotFoundException(`User with ID ${id} not found.`);
    
    return user as UserWithRelations; // Cast the result
  }


  // PATCH /users/:id: Update User Info
  async update(id: string, data: UpdateResidentDto): Promise<User> {
    const updateData: any = { ...data };
    
    // Handle password update separately
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    
    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  // DELETE /users/:id: Delete User
  async deactivate(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { userStatus: 'INACTIVE', updatedAt: new Date() },
    });
  }
}