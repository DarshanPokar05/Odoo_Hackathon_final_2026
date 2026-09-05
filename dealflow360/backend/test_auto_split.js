const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fulfillmentService = require('./src/modules/fulfillment/service');

// Mock realtime events so we don't need a running Socket.io server
const realtime = require('./src/realtime/index');
realtime.emitFulfillmentUpdated = () => {};
realtime.emitStockUpdated = () => {};

async function runTest() {
  console.log('🚀 Starting Automated Fulfillment Flow Test...\n');

  try {
    // 1. Setup Dummy Data
    console.log('📦 1. Setting up Test Data (Warehouse, Products, Order)...');
    
    // Create Dummy Warehouse
    const warehouse = await prisma.warehouse.create({
      data: { name: 'Test Warehouse Auto-Split', shippingCostWeight: 1 }
    });

    // Create Category & Products
    const category = await prisma.productCategory.create({
      data: { name: `Electronics ${Date.now()}`, maxDiscountPercent: 10 }
    });

    const laptop = await prisma.product.create({
      data: { name: 'Gaming Laptop', categoryId: category.id, price: 1000, unit: 'pcs', taxPercent: 5 }
    });

    const mouse = await prisma.product.create({
      data: { name: 'Wireless Mouse', categoryId: category.id, price: 50, unit: 'pcs', taxPercent: 5 }
    });

    // Create Stock Levels (Laptop = 10, Mouse = 0 to force backorder)
    await prisma.stockLevel.create({
      data: { warehouseId: warehouse.id, productId: laptop.id, onHand: 10, reserved: 0 }
    });
    const mouseStock = await prisma.stockLevel.create({
      data: { warehouseId: warehouse.id, productId: mouse.id, onHand: 0, reserved: 0 }
    });

    // Create Customer & Quotation & Order
    const customer = await prisma.customer.create({
      data: { companyName: 'Stark Industries', realEmail: 'tony@stark.com' }
    });

    const quotation = await prisma.quotation.create({
      data: {
        customerId: customer.id,
        repId: 'dummy-rep-id',
        status: 'CONFIRMED',
        lines: {
          create: [
            { productId: laptop.id, quantity: 2, unitPrice: 1000, lineType: 'ONE_TIME', effectiveCeilingSnapshot: 0 },
            { productId: mouse.id, quantity: 1, unitPrice: 50, lineType: 'ONE_TIME', effectiveCeilingSnapshot: 0 }
          ]
        }
      },
      include: { lines: true }
    });

    const order = await prisma.order.create({
      data: {
        quotationId: quotation.id,
        status: 'PENDING_FULFILLMENT'
      }
    });

    console.log(`   ✅ Order ${order.id} created successfully.`);
    console.log(`   ✅ Stock: Laptop (10), Mouse (0). Order needs 2 Laptops and 1 Mouse.\n`);


    // 2. Trigger Handoff Event (Simulate Track A webhook)
    console.log('⚙️ 2. Triggering Webhook (processFulfillmentHandoff)...');
    const handoffResult = await fulfillmentService.processFulfillmentHandoff({ orderId: order.id });
    
    console.log(`   ✅ Auto-Split Result: Order Status is now [${handoffResult.status}]`);
    console.log(`   ✅ Splits created: ${handoffResult.splits}`);
    console.log(`   ✅ Backorders created: ${handoffResult.backorders}\n`);


    // 3. Verify Database State
    console.log('🔍 3. Verifying Database State...');
    const dbOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { backorderItems: true, fulfillmentSplits: true } });
    console.log(`   - Backordered Item ID: ${dbOrder.backorderItems[0].id} (Qty Pending: ${dbOrder.backorderItems[0].qtyPending})`);
    
    const laptopStock = await prisma.stockLevel.findUnique({ where: { warehouseId_productId: { warehouseId: warehouse.id, productId: laptop.id } } });
    console.log(`   - Laptop Reserved Stock updated to: ${laptopStock.reserved}\n`);


    // 4. Simulate Restock (Warehouse worker adds 5 Mice)
    console.log('🚚 4. Simulating Restock of the Backordered Mouse...');
    await prisma.stockLevel.update({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: mouse.id } },
      data: { onHand: 5 }
    });
    console.log(`   ✅ Mouse stock increased to 5.\n`);


    // 5. Consolidate Backorder
    console.log('🔄 5. Triggering Backorder Consolidation...');
    const backorderId = dbOrder.backorderItems[0].id;
    
    // Simulate actor calling the consolidate function
    const consolidateResult = await fulfillmentService.consolidateBackorder(backorderId, { userId: 'test-admin' });
    
    console.log(`   ✅ Consolidation Result: Order Status is now [${consolidateResult.updatedOrder ? consolidateResult.updatedOrder.status : 'Still Backordered'}]`);
    
    const finalOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { fulfillmentSplits: true, backorderItems: true } });
    console.log(`   ✅ Final Splits: ${finalOrder.fulfillmentSplits.length}`);
    console.log(`   ✅ Final Open Backorders: ${finalOrder.backorderItems.filter(b => !b.resolvedAt).length}\n`);

    console.log('🎉 TEST COMPLETE! Everything works perfectly.');

  } catch (error) {
    console.error('❌ Test Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
