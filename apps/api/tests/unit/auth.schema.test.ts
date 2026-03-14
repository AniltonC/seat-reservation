import { describe, expect, it} from "vitest";
import { registerSchema } from "../../src/schemas/auth.schema";


describe("RegisterSchema", () => {
    describe("[TC-AUTH-002] register with invalid data", () => {
        it("[STEP-1] should throw an error indicating name is required", () => {
            const result = registerSchema.safeParse({
                name: "",
                email: "john@test.com",
                password: "Senha123",
            })

            expect(result.success).toBe(false)
            expect(result.error?.issues[0].path[0]).toBe('name')
            expect(result.error?.issues[0].message).toBe('Name must be at least 2 characters')
        })

        it("[STEP-2] should throw an error indicating email format is invalid", () => {
            const result = registerSchema.safeParse({
                name: "John Doe",
                email: "john.test.com",
                password: "Senha123",
            })

            expect(result.success).toBe(false)
            expect(result.error?.issues[0].path[0]).toBe('email')
            expect(result.error?.issues[0].message).toBe('Invalid email address')
        })

        it("[STEP-3] should throw an error indicating password is too short", () => {
            const result = registerSchema.safeParse({
                name: "John Doe",
                email: "john@test.com",
                password: "Sen123",
            })

            expect(result.success).toBe(false)
            expect(result.error?.issues[0].path[0]).toBe('password')
            expect(result.error?.issues[0].message).toBe('Password must be at least 8 characters')
        })

        it("[STEP-4] should throw an error indicating password needs an uppercase letter", () => {
            const result = registerSchema.safeParse({
                name: "John Doe",
                email: "john@test.com",
                password: "senha123",
            })

            expect(result.success).toBe(false)
            expect(result.error?.issues[0].path[0]).toBe('password')
            expect(result.error?.issues[0].message).toBe('Password must have at least 1 uppercase letter')
        })

        it("[STEP-5] should throw an error indicating password needs a numeric character", () => {
            const result = registerSchema.safeParse({
                name: "John Doe",
                email: "john@test.com",
                password: "Password",
            })

            expect(result.success).toBe(false)
            expect(result.error?.issues[0].path[0]).toBe('password')
            expect(result.error?.issues[0].message).toBe('Password must have at least 1 uppercase letter')
        })

        it("[STEP-6] should throw all errors when all fields are missing", () => {
            const result = registerSchema.safeParse({})

            expect(result.success).toBe(false)
            expect(result.error?.issues.length).toBeGreaterThanOrEqual(3)
            const paths = result.error?.issues.map(issue => issue.path[0])
            expect(paths).toContain("name")
            expect(paths).toContain("email")
            expect(paths).toContain("password")
        })
    })
})