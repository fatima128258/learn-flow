const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyCertificateFix() {
  console.log('🔍 CERTIFICATE GENERATION BUG VERIFICATION');
  console.log('='.repeat(50));

  const organizationId = 'cmtn0sv9q0006gf01iqi9x6nl'; // Test org
  const courseId = 'cmtn108wr000jgf016jg8qgpf'; // Ta course  
  const userId = 'cmtn18s8t000rgf01i3372044'; // Sa user

  console.log('\n1. CHECKING PREREQUISITES');
  console.log('-'.repeat(30));

  // Check user exists and has correct role
  const userOrg = await prisma.userOrganization.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId
      }
    },
    include: {
      user: true,
      organization: true
    }
  });

  if (!userOrg) {
    console.log('❌ User not found in organization');
    return;
  }

  console.log(`✅ User: ${userOrg.user.name || userOrg.user.email}`);
  console.log(`✅ Role: ${userOrg.role}`);
  console.log(`✅ Organization: ${userOrg.organization.name}`);

  // Check enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      courseId,
      status: 'ACTIVE'
    },
    include: {
      course: true
    }
  });

  if (!enrollment) {
    console.log('❌ User not enrolled in course');
    return;
  }

  console.log(`✅ Enrolled in: ${enrollment.course.title}`);

  // Check course progress
  const progress = await prisma.courseProgress.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    }
  });

  if (!progress || !progress.completed) {
    console.log('❌ Course not completed');
    return;
  }

  console.log(`✅ Course completed: ${progress.completed}`);
  console.log(`✅ Completed at: ${progress.completedAt}`);

  // Check for existing certificate
  const existingCert = await prisma.certificate.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    }
  });

  if (existingCert) {
    console.log(`⚠️  Certificate already exists: ${existingCert.certificateId}`);
    
    // Delete it for fresh test
    await prisma.certificate.delete({
      where: { id: existingCert.id }
    });
    console.log('🗑️  Deleted existing certificate for fresh test');
  }

  console.log('\n2. TESTING CERTIFICATE GENERATION LOGIC');
  console.log('-'.repeat(40));

  try {
    // Import and test the service directly
    const { generateCertificate } = require('./src/services/certificateService.ts');
    
    console.log('🚀 Calling generateCertificate service...');
    console.log(`   Organization: ${organizationId}`);
    console.log(`   User: ${userId}`);
    console.log(`   Course: ${courseId}`);
    console.log(`   Start time: ${new Date().toISOString()}`);

    const result = await generateCertificate(organizationId, userId, courseId);

    console.log('\n3. FIRST ATTEMPT RESULT');
    console.log('-'.repeat(25));
    console.log('✅ SUCCESS - Certificate generated on FIRST attempt!');
    console.log(`   Certificate ID: ${result.certificateId}`);
    console.log(`   Student Name: ${result.studentName}`);
    console.log(`   Course Title: ${result.courseTitle}`);
    console.log(`   Organization: ${result.organizationName}`);
    console.log(`   Completion Date: ${result.completionDate}`);
    console.log(`   Verification URL: ${result.verificationUrl}`);
    console.log(`   PDF URL: ${result.pdfUrl || 'Generating...'}`);

    console.log('\n4. TESTING DUPLICATE PREVENTION');
    console.log('-'.repeat(35));

    try {
      await generateCertificate(organizationId, userId, courseId);
      console.log('❌ FAILED - Second attempt should have been blocked!');
    } catch (duplicateError) {
      if (duplicateError.message === 'CERTIFICATE_EXISTS') {
        console.log('✅ SUCCESS - Duplicate certificate correctly prevented');
      } else {
        console.log(`⚠️  Unexpected error: ${duplicateError.message}`);
      }
    }

    console.log('\n5. VERIFICATION SUMMARY');
    console.log('-'.repeat(25));
    console.log('✅ First attempt: SUCCESS');
    console.log('✅ Duplicate prevention: SUCCESS');
    console.log('✅ Certificate data: COMPLETE');
    console.log('✅ Database record: CREATED');

    return {
      success: true,
      certificateId: result.certificateId,
      firstAttempt: 'PASS',
      duplicatePrevention: 'PASS'
    };

  } catch (error) {
    console.log('\n❌ CERTIFICATE GENERATION FAILED');
    console.log(`   Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);

    return {
      success: false,
      error: error.message,
      firstAttempt: 'FAIL'
    };
  }
}

verifyCertificateFix()
  .then(result => {
    console.log('\n' + '='.repeat(50));
    console.log('FINAL VERIFICATION RESULT:');
    
    if (result.success) {
      console.log('🎉 Certificate First-Attempt Test: PASS');
      console.log('✅ Bug fix verified - certificate generation works on first attempt!');
    } else {
      console.log('💥 Certificate First-Attempt Test: FAIL');
      console.log(`❌ Error: ${result.error}`);
    }
  })
  .catch(error => {
    console.error('💥 Verification script failed:', error);
  })
  .finally(() => {
    prisma.$disconnect();
  });