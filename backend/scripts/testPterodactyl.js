/**
 * Test Pterodactyl Configuration
 * This script validates your Pterodactyl API connection and configuration
 * without creating any actual servers or users.
 */

import axios from "axios"
import { env } from "../src/config/env.js"

const client = axios.create({
  baseURL: `${env.PTERODACTYL_URL.replace(/\/$/, "")}/api/application`,
  headers: {
    Authorization: `Bearer ${env.PTERODACTYL_API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  },
  timeout: 15000
})

async function testConnection() {
  console.log("\n🔍 Testing Pterodactyl Configuration\n")
  console.log("=" .repeat(60))
  
  // Test 1: Environment Variables
  console.log("\n1️⃣  Checking Environment Variables...")
  const requiredVars = {
    PTERODACTYL_URL: env.PTERODACTYL_URL,
    PTERODACTYL_API_KEY: env.PTERODACTYL_API_KEY ? "***" + env.PTERODACTYL_API_KEY.slice(-4) : undefined,
    PTERODACTYL_DEFAULT_NODE: env.PTERODACTYL_DEFAULT_NODE,
    PTERODACTYL_DEFAULT_EGG: env.PTERODACTYL_DEFAULT_EGG,
    PTERODACTYL_DEFAULT_DOCKER_IMAGE: env.PTERODACTYL_DEFAULT_DOCKER_IMAGE,
    PTERODACTYL_DEFAULT_STARTUP: env.PTERODACTYL_DEFAULT_STARTUP,
    PTERODACTYL_DEFAULT_ENV: env.PTERODACTYL_DEFAULT_ENV
  }
  
  const optionalVars = {
    PTERODACTYL_DEFAULT_ALLOCATION: env.PTERODACTYL_DEFAULT_ALLOCATION
  }
  
  let missingVars = []
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      missingVars.push(key)
      console.log(`   ✗ ${key}: MISSING`)
    } else {
      console.log(`   ✓ ${key}: ${value}`)
    }
  }
  
  for (const [key, value] of Object.entries(optionalVars)) {
    if (value) {
      console.log(`   ✓ ${key}: ${value}`)
    } else {
      console.log(`   ℹ ${key}: Not set (will use dynamic allocation)`)
    }
  }
  
  if (missingVars.length > 0) {
    console.log("\n❌ Missing required variables:", missingVars.join(", "))
    console.log("Please set these in your .env file")
    process.exit(1)
  }
  
  // Test 2: API Connection
  console.log("\n2️⃣  Testing API Connection...")
  try {
    const response = await client.get("/nodes")
    console.log(`   ✓ Connected to Pterodactyl successfully`)
    console.log(`   ✓ Found ${response.data.data.length} node(s)`)
  } catch (error) {
    console.log(`   ✗ Connection failed:`, error.message)
    if (error.response) {
      console.log(`   Response status: ${error.response.status}`)
      console.log(`   Response data:`, error.response.data)
    }
    console.log("\n❌ Cannot connect to Pterodactyl panel")
    console.log("Check your PTERODACTYL_URL and PTERODACTYL_API_KEY")
    process.exit(1)
  }
  
  // Test 3: Node exists
  console.log("\n3️⃣  Validating Node...")
  try {
    const response = await client.get(`/nodes/${env.PTERODACTYL_DEFAULT_NODE}`)
    const node = response.data.attributes
    console.log(`   ✓ Node found: ${node.name}`)
    console.log(`   - Location: ${node.location_id}`)
    console.log(`   - FQDN: ${node.fqdn}`)
    console.log(`   - Memory: ${(node.memory / 1024).toFixed(2)}GB`)
  } catch (error) {
    console.log(`   ✗ Node ${env.PTERODACTYL_DEFAULT_NODE} not found`)
    if (error.response?.status === 404) {
      console.log("   This node ID does not exist on your panel")
    }
    console.log("\n❌ Invalid PTERODACTYL_DEFAULT_NODE")
    process.exit(1)
  }
  
  // Test 4: Allocation exists
  console.log("\n4️⃣  Validating Allocation...")
  try {
    const response = await client.get(`/nodes/${env.PTERODACTYL_DEFAULT_NODE}/allocations`)
    const allocations = response.data.data
    
    if (env.PTERODACTYL_DEFAULT_ALLOCATION) {
      // Validate specific allocation if configured
      const allocation = allocations.find(a => a.attributes.id === env.PTERODACTYL_DEFAULT_ALLOCATION)
      
      if (allocation) {
        const alloc = allocation.attributes
        console.log(`   ✓ Allocation found: ${alloc.ip}:${alloc.port}`)
        console.log(`   - Assigned: ${alloc.assigned ? 'Yes (in use)' : 'No (available)'}`)
        
        if (alloc.assigned) {
          console.log("   ⚠️  Warning: This allocation is already in use")
          console.log("      Servers may fail to create. Use an unassigned allocation.")
        }
      } else {
        console.log(`   ✗ Allocation ${env.PTERODACTYL_DEFAULT_ALLOCATION} not found on this node`)
        console.log(`   Available allocations:`)
        allocations.slice(0, 5).forEach(a => {
          const attr = a.attributes
          console.log(`      - ID ${attr.id}: ${attr.ip}:${attr.port} (${attr.assigned ? 'in use' : 'available'})`)
        })
        console.log("\n❌ Invalid PTERODACTYL_DEFAULT_ALLOCATION")
        process.exit(1)
      }
    } else {
      // Dynamic allocation mode - check if any are available
      const availableAllocations = allocations.filter(a => !a.attributes.assigned)
      
      console.log(`   ℹ No specific allocation configured (using dynamic mode)`)
      console.log(`   ✓ Found ${availableAllocations.length} available allocation(s)`)
      
      if (availableAllocations.length > 0) {
        console.log(`   Available allocations (showing first 5):`)
        availableAllocations.slice(0, 5).forEach(a => {
          const attr = a.attributes
          console.log(`      - ID ${attr.id}: ${attr.ip}:${attr.port}`)
        })
      } else {
        console.log(`   ✗ No available allocations found on node ${env.PTERODACTYL_DEFAULT_NODE}`)
        console.log("      Please create allocations in Pterodactyl panel:")
        console.log("      Admin → Nodes → Select Node → Allocations → Assign New")
        console.log("\n❌ No available allocations")
        process.exit(1)
      }
    }
  } catch (error) {
    console.log(`   ✗ Cannot validate allocation:`, error.message)
    console.log("\n⚠️  Allocation validation failed, but might still work")
  }
  
  // Test 5: Egg exists
  console.log("\n5️⃣  Validating Egg...")
  try {
    // Eggs are nested under nests, so we need to search
    const nestsResponse = await client.get("/nests")
    let eggFound = false
    
    for (const nest of nestsResponse.data.data) {
      try {
        const eggsResponse = await client.get(`/nests/${nest.attributes.id}/eggs`)
        const egg = eggsResponse.data.data.find(e => e.attributes.id === env.PTERODACTYL_DEFAULT_EGG)
        
        if (egg) {
          const eggAttr = egg.attributes
          console.log(`   ✓ Egg found: ${eggAttr.name}`)
          console.log(`   - Nest: ${nest.attributes.name}`)
          console.log(`   - Author: ${eggAttr.author}`)
          eggFound = true
          break
        }
      } catch (err) {
        // Skip if we can't access this nest
      }
    }
    
    if (!eggFound) {
      console.log(`   ✗ Egg ${env.PTERODACTYL_DEFAULT_EGG} not found`)
      console.log("\n❌ Invalid PTERODACTYL_DEFAULT_EGG")
      process.exit(1)
    }
  } catch (error) {
    console.log(`   ✗ Cannot validate egg:`, error.message)
    console.log("\n⚠️  Egg validation failed, but might still work")
  }
  
  // Test 6: Parse environment variables
  console.log("\n6️⃣  Validating Environment JSON...")
  try {
    const envVars = JSON.parse(env.PTERODACTYL_DEFAULT_ENV || "{}")
    console.log(`   ✓ Valid JSON with ${Object.keys(envVars).length} variable(s)`)
    Object.entries(envVars).forEach(([key, value]) => {
      console.log(`      ${key}=${value}`)
    })
  } catch (error) {
    console.log(`   ✗ Invalid JSON in PTERODACTYL_DEFAULT_ENV`)
    console.log(`   ${error.message}`)
    console.log("\n❌ Fix your PTERODACTYL_DEFAULT_ENV")
    process.exit(1)
  }
  
  // Success!
  console.log("\n" + "=".repeat(60))
  console.log("\n✅ All tests passed! Your Pterodactyl configuration is valid.")
  console.log("\nYou can now start the backend server with: npm run dev\n")
  process.exit(0)
}

testConnection().catch(error => {
  console.error("\n❌ Unexpected error:", error)
  process.exit(1)
})
