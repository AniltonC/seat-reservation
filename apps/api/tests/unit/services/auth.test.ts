import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthService } from "../../../src/services/auth.service";
import { ConflictError } from "../../../src/errors/conflict.error";

// Test Suite
describe("AuthService", ()=>{
    // Mock User
    const mockUserRepository = {
        findByEmail: vi.fn(),
        create: vi.fn()
    }
    const mockHashFn = vi.fn();

    let authService: AuthService;
    const newUser = {
        id: "user-001",
        name: "John Doe",
        email: "john@test.com",
        createdAt: new Date()
    }
    beforeEach(() => {
        vi.clearAllMocks()
        authService = new AuthService(mockUserRepository, mockHashFn)
        // Injecting null in findByEmail
        mockUserRepository.findByEmail.mockResolvedValue(null)
        // Injecting a new user in create
        mockUserRepository.create.mockResolvedValue(newUser)
        mockHashFn.mockResolvedValue('$2b$10$hashedpassword');

    })

    describe("register with valid data", () => {
        const registerInput = {
            name: "John Doe",
            email: "john@test.com",
            password: "Senha123",
            createdAt: expect.any(Date),
        }
        // Step 1: Send a registration
        it("[TC-AUTH-001] should return a new user object without the password", async () => {
            const result = await authService.register(registerInput)

            expect(result).toMatchObject(newUser)
            expect(result).not.toHaveProperty("password")
        })

        // Step 2: Verify the password
        it("[TC-AUTH-001] should return the bcrypt hashed password, not a plain text", async () => {
            await authService.register(registerInput)

            const savedPwd = mockUserRepository.create.mock.calls[0][0].password

            expect(mockHashFn).toHaveBeenCalledWith("Senha123", expect.any(Number))
            expect(savedPwd).not.toBe("Senha123")
            expect(savedPwd).toMatch(/^\$2b\$/)
        })

        // Step 3: Register again with the same email
        it("[TC-AUTH-001] should throw a ConflictError when email is already in use", async () => {
            mockUserRepository.findByEmail.mockResolvedValue({
                id: "user-001",
                email: "john@test.com"
            })

            await expect(authService.register(registerInput)).rejects.toThrow(ConflictError)

            expect(mockUserRepository.create).not.toHaveBeenCalled();
        })
    })
    
})  