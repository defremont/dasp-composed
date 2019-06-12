/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Write your transction processor functions here
 */
let ROOT_NAMESPACE = "org.dasp.net";
let AUTHOR = ROOT_NAMESPACE + ".Author";
let DETAILS = ROOT_NAMESPACE + ".Details";
let REVISION = ROOT_NAMESPACE + ".Revision";
let ARTICLE = ROOT_NAMESPACE + ".Article";

/**
 * Change Article Hash
 * @param {org.dasp.net.NewHash} NewHash
 * @transaction
 */
async function newHash(NewHash) {
  // Save the old value of the hash.
  const oldHash = NewHash.article.hash;

  // Update the hash with the new value.
  NewHash.article.hash = NewHash.newHash;

  NewHash.article.points = 0;
  NewHash.article.revCount = 0;
  NewHash.article.needRev = false;

  // Get the asset registry for the asset.
  const articleRegistry = await getAssetRegistry(ARTICLE);
  // Update the asset in the asset registry.
  await articleRegistry.update(NewHash.article);

  // Emit an event for the modified asset.
  let event = getFactory().newEvent("org.dasp.net", "NewHashEvent");
  event.article = NewHash.article;
  event.oldHash = oldHash;
  event.newHash = NewHash.newHash;
  emit(event);
}
/**
 * creates an revisions with article and reviewer
 * @param {org.dasp.net.Scheduler} scheduler
 * @transaction
 */

async function Scheduler(scheduler) {
  let currentdate = new Date();
  if (
    currentdate.getTime() - scheduler.revision.date.getTime() > 850000000 &&
    !scheduler.revision.complete
  ) {
    let articleRegistry = await getAssetRegistry(ARTICLE);
    // pega revisoes atrasadas
    let revisionRegistry = await getAssetRegistry(REVISION);
    // Get all of the drivers in the driver participant registry.
    let revisions = await revisionRegistry.getAll();
    let outDatedRevisions = [];

    // Update the asset with the new value.
    let revisors = [];
    let prerevisors = [];
    let count = 0;
    let factory = getFactory();
    // Get the driver participant registry.
    let participantRegistry = await getParticipantRegistry(AUTHOR);
    // Get all of the drivers in the driver participant registry.
    let authors = await participantRegistry.getAll();
    // Get all the reviewers to chosen the new one
    scheduler.revision.article.revisions.forEach(function(revision) {
      if (
        scheduler.revision.reviewer.getIdentifier() !== revision.reviewer.email
      ) {
        prerevisors.push(revision.reviewer.email);
      }
    });
    await authors.forEach(author => {
      if (
        author.email !== scheduler.revision.reviewer.getIdentifier() &&
        author.isReviewer &&
        author.email !== scheduler.revision.article.author.getIdentifier()
      ) {
        if (prerevisors.indexOf(author.email) > -1) {
        } else {
          revisors.push(author);
          count++;
        }
      }
    });
    // Verification needed in the case of get a same reviewer
    let randRevisor = Math.floor(Math.random() * (count - 1 + 1) + 0);
    let reviewer = factory.newRelationship(
      ROOT_NAMESPACE,
      "Author",
      revisors[randRevisor].email
    );
    scheduler.revision.acc = false;

    await request.post({
      uri: "http://172.17.0.1:1880/hello",
      json: {
        to: reviewer.getIdentifier(),
        topic: "DASP - You received a revision to evaluate",
        body:
          "Article Title:<br/>" +
          scheduler.revision.articleTags +
          "<br/>Article Tags:<br/>" +
          scheduler.revision.articleTitle +
          "<br/>Access DASP to review this article."
      }
    });
    scheduler.revision.reviewer = reviewer;
    scheduler.revision.date = scheduler.timestamp;
    // Update the asset in the asset registry.
    await revisionRegistry.update(scheduler.revision);
  }
}
/**
 * creates an revisions with article and reviewer
 * @param {org.dasp.net.CreateRevision} createRevision
 * @transaction
 */

async function CreateRevision(createRevision) {
  let revisors = [];
  let revisions = [];
  let count = 0;
  let factory = getFactory();
  let reviewers = [];
  let participantRegistry = await getParticipantRegistry(AUTHOR);
  // Get all of the drivers in the driver participant registry.
  let authors = await participantRegistry.getAll();
  // Get the asset registry for the asset.
  const revisionRegistry = await getAssetRegistry(REVISION);
  const articleRegistry = await getAssetRegistry(ARTICLE);
  let revs = await revisionRegistry.getAll();
  //need revision workflow
  if (createRevision.article.revisions.length >= 5) {
    // If article of revision already have 5 revisors
    createRevision.article.revisions.forEach(function(revision) {
      revs.forEach(rev => {
        if (
          JSON.stringify(rev.revisionId) === JSON.stringify(revision.revisionId)
        ) {
          reviewers.push(rev.reviewer);
        }
      });
    });
    for (let i = 0; i < 5; i++) {
      // Get each revisor of article and create news revisions for each of them
      revisions[i] = factory.newResource(
        ROOT_NAMESPACE,
        "Revision",
        createRevision.transactionId + i
      );
      revisions[i].hash = createRevision.article.hash;
      revisions[i].notes = "not reviewed yet";
      revisions[i].articleTitle = createRevision.article.title;
      revisions[i].articleTags = createRevision.article.tags;
      revisions[i].revisionType = "HALFBLIND";
      revisions[i].reviewer = reviewers[i];
      revisions[i].date = createRevision.timestamp;
      revisions[i].article = createRevision.article;
      await request.post({
        uri: "http://172.17.0.1:1880/hello",
        json: {
          to: reviewers[i].getIdentifier(),
          topic: "DASP - You received a revision to evaluate",
          body:
            "Article Title:<br/>" +
            createRevision.article.tags +
            "<br/>Article Tags:<br/>" +
            createRevision.article.title +
            "<br/>Access DASP to review this article."
        }
      });
    }
    createRevision.article.revisions = revisions;

    await articleRegistry.update(createRevision.article);
    return getAssetRegistry(REVISION)
      .then(function(revisionRegistry) {
        return revisionRegistry.addAll(revisions);
      })
      .catch(function(error) {
        console.log(error);
        throw error;
      });
  } else {
    // Else (if article has not 5 revisors) For each author, check if is reviewer.
    authors.forEach(function(author) {
      if (author.isReviewer) {
        if (author.email !== getCurrentParticipant().getIdentifier()) {
          revisors.push(author);
          count++;
        }
        // Push reviewer in revisors array
      }
    });
    // Get random numbers from list of revisors
    function randomNumbers(max) {
      function range(upTo) {
        var result = [];
        for (var i = 0; i < upTo; i++) result.push(i);
        return result;
      }
      function shuffle(o) {
        // Shuffle list to get randomic top 5
        for (
          var j, x, i = o.length;
          i;
          j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x
        );
        return o;
      }
      var myArr = shuffle(range(max));
      return function() {
        return myArr.shift();
      };
    }
    var randoms = randomNumbers(revisors.length),
      rand = randoms(),
      result = [];
    while (rand != null) {
      result.push(rand);
      rand = randoms();
    }

    // For each chosen reviewer, create a revision
    const articleRegistry = await getAssetRegistry(ARTICLE);
    for (let i = 0; i < 5; i++) {
      reviewers.push(
        factory.newRelationship(
          ROOT_NAMESPACE,
          "Author",
          revisors[result[i]].email
        )
      );

      revisions[i] = factory.newResource(
        ROOT_NAMESPACE,
        "Revision",
        createRevision.transactionId + i
      );
      revisions[i].hash = createRevision.article.hash;
      revisions[i].notes = "#";
      revisions[i].revisionType = "FULLBLIND";
      revisions[i].articleTitle = createRevision.article.title;
      revisions[i].articleTags = createRevision.article.tags;
      revisions[i].reviewer = reviewers[i];
      revisions[i].date = createRevision.timestamp;
      revisions[i].article = createRevision.article;
      createRevision.article.revisions.push(revisions[i]);
      await request.post({
        uri: "http://172.17.0.1:1880/hello",
        json: {
          to: reviewers[i].getIdentifier(),
          topic: "DASP - You received a revision to evaluate",
          body:
            "Article Title: " +
            createRevision.article.title +
            "<br/>Article Tags: " +
            createRevision.article.tags +
            "<br/>Access DASP to review this article."
        }
      });
      // Update the asset in the asset registry.
    }
    await articleRegistry.update(createRevision.article);

    return getAssetRegistry(REVISION)
      .then(function(revisionRegistry) {
        return revisionRegistry.addAll(revisions);
      })
      .catch(function(error) {
        console.log(error);
        throw error;
      });
  }
} // Send e-mail needed here after transaction CreateRevision

/**
 * Transaction to POSITIVE decision of reviewer about ACCEPT or NOT ACCEPT to take the revision
 * @param {org.dasp.net.ReviewAccept} reviewAccept
 * @transaction
 */

async function ReviewAccept(reviewAccept) {
  // Update the revision acc atribute with 'true' value.
  reviewAccept.revision.acc = true;
  reviewAccept.revision.date = reviewAccept.timestamp;

  // Get the asset registry for the asset.
  const revisionRegistry = await getAssetRegistry(REVISION);
  // Update the asset in the asset registry.
  await revisionRegistry.update(reviewAccept.revision);
}

/**
 * Transaction to NEGATIVE decision of reviewer about ACCEPT or NOT ACCEPT to take the revision
 * @param {org.dasp.net.ReviewRejected} reviewRejected
 * @transaction
 */

async function ReviewRejected(reviewRejected) {
  // Update the asset with the new value.
  let revisors = [];
  let prerevisors = [];
  let count = 0;
  let factory = getFactory();
  // Get the driver participant registry.
  let participantRegistry = await getParticipantRegistry(AUTHOR);
  // Get all of the drivers in the driver participant registry.
  let authors = await participantRegistry.getAll();
  // Get all the reviewers to chosen the new one
  reviewRejected.revision.article.revisions.forEach(function(revision) {
    if (getCurrentParticipant().getIdentifier() !== revision.reviewer.email) {
      prerevisors.push(revision.reviewer.email);
    }
  });
  await authors.forEach(author => {
    if (
      author.email !== getCurrentParticipant().getIdentifier() &&
      author.isReviewer &&
      author.email !== reviewRejected.revision.article.author.getIdentifier()
    ) {
      if (prerevisors.indexOf(author.email) > -1) {
      } else {
        revisors.push(author);
        count++;
      }
    }
  });
  // Verification needed in the case of get a same reviewer
  let randRevisor = Math.floor(Math.random() * (count - 1 + 1) + 0);
  // if(!revisors[randRevisor].email){

  // }
  let reviewer = factory.newRelationship(
    ROOT_NAMESPACE,
    "Author",
    revisors[randRevisor].email
  );
  reviewRejected.revision.acc = false;
  await request.post({
    uri: "http://172.17.0.1:1880/hello",
    json: {
      to: reviewer.getIdentifier(),
      topic: "DASP - You received a revision to evaluate",
      body:
        "Article Title:<br/>" +
        reviewRejected.revision.articleTitle +
        "<br/>Article Tags:<br/>" +
        reviewRejected.revision.articleTags +
        "<br/>Access DASP to review this article."
    }
  });
  reviewRejected.revision.reviewer = reviewer;
  reviewRejected.revision.date = reviewRejected.timestamp;
  // Get the asset registry for the asset.
  const revisionRegistry = await getAssetRegistry(REVISION);
  // Update the asset in the asset registry.
  await revisionRegistry.update(reviewRejected.revision);
}
/**
 * Transaction for rating of revision
 * @param {org.dasp.net.RateRevision} rateRevision
 * @transaction
 */

async function RateRevision(rateRevision) {
  // Update the asset with the new value.
  // If the reviewer accept the article, sum 1 to atributte acc's.
  rateRevision.revision.notes = rateRevision.notes;
  rateRevision.revision.points = rateRevision.points;
  rateRevision.revision.complete = true;
  // If article reach x or more points
  if (rateRevision.points == 2) {
    rateRevision.revision.concept = "Rejected";
  } else if (rateRevision.points == 4) {
    rateRevision.revision.concept = "Weak Rejected";
  } else if (rateRevision.points == 6) {
    rateRevision.revision.concept = "Border Line";
  } else if (rateRevision.points == 8) {
    rateRevision.revision.concept = "Weak Accepted";
  } else if (rateRevision.points == 10) {
    rateRevision.revision.concept = "Accepted";
  }
  // Get the asset registry for the asset.
  const authorRegistry = await getParticipantRegistry(AUTHOR);
  // Get the asset registry for the asset.
  const revisionRegistry = await getAssetRegistry(REVISION);
  // Update the asset in the asset registry.
  await revisionRegistry.update(rateRevision.revision);
  // If the article already reach the maximum of 5 rated revisions
  // Get the asset registry for the asset.
  const articleRegistry = await getAssetRegistry(ARTICLE);
  rateRevision.revision.article.points += rateRevision.revision.points / 5;
  // Calculate average points of article
  rateRevision.revision.article.revCount += 1;
  // Update the asset in the asset registry.
  await articleRegistry.update(rateRevision.revision.article);
  if (rateRevision.revision.article.revCount >= 5) {
    await request.post({
      uri: "http://172.17.0.1:1880/hello",
      json: {
        to: rateRevision.revision.article.author.getIdentifier(),
        topic: "DASP - Your article has been rated",
        body:
          "Article Title:<br/>" +
          rateRevision.revision.article.title +
          "<br/>Article Tags:<br/>" +
          rateRevision.revision.article.tags +
          "<br/>Access DASP to review this article."
      }
    });
    // Insert author concept
    if (rateRevision.revision.article.points <= 2) {
      rateRevision.revision.article.concept = "Rejected";
    } else if (rateRevision.revision.article.points <= 4) {
      rateRevision.revision.article.concept = "Weak Rejected";
    } else if (rateRevision.revision.article.points <= 6) {
      rateRevision.revision.article.concept = "Border Line";
    } else if (rateRevision.revision.article.points <= 8) {
      rateRevision.revision.article.concept = "Weak Accepted";
    } else if (rateRevision.revision.article.points <= 10) {
      rateRevision.revision.article.concept = "Accepted";
    }
    if (rateRevision.revision.article.points > 6) {
      await request.post({
        uri: "http://172.17.0.1:1880/hello",
        json: {
          to: rateRevision.revision.article.author.getIdentifier(),
          topic:
            "DASP - Congratulations, your article has been published! You are now a reviewer."
        }
      });

      // Author turns in Reviewer
      rateRevision.revision.article.author.points +=
        rateRevision.revision.article.points;
      // Publish the article
      rateRevision.revision.article.published = true;
      // Author turns in Reviewer
      rateRevision.revision.article.author.isReviewer = true;
      // Update the asset in the asset registry.
      rateRevision.revision.article.needRev = false;
      await authorRegistry.update(rateRevision.revision.article.author);
      // Update the asset in the asset registry.
      await articleRegistry.update(rateRevision.revision.article);
    } else {
      // Else (if the article reaches 6 or more points, but it was not accepted by the majority.)
      // Need other revision of sames revisors.
      rateRevision.revision.article.needRev = true;
      // Update the asset in the asset registry.
      await articleRegistry.update(rateRevision.revision.article);
    }
  }
}

/**
 * Transaction for submit new Article
 * @param {org.dasp.net.NewArticle} newArticle
 * @transaction
 */

async function NewArticle(newArticle) {
  let article;
  let factory = getFactory();
  // Create new resource (Article)
  article = factory.newResource(
    ROOT_NAMESPACE,
    "Article",
    newArticle.transactionId
  );

  // Update the new asset with values.
  article.hash = newArticle.hash;
  article.tags = newArticle.tags;
  article.title = newArticle.title;
  article.author = getCurrentParticipant();
  article.date = newArticle.timestamp;
  article.revisions = [];

  return getAssetRegistry(ARTICLE)
    .then(function(articleRegistry) {
      return articleRegistry.add(article);
    })
    .catch(function(error) {
      console.log(error);
      throw error;
    });
}
/**
 * Transaction for new Author, maybe not needed
 * @param {org.dasp.net.NewAuthor} newAuthor
 * @transaction
 */

async function NewAuthor(newAuthor) {
  let participantRegistry = await getParticipantRegistry(AUTHOR);
  let detailsRegistry = await getAssetRegistry(DETAILS);
  let author;
  let factory = getFactory();
  author = factory.newResource(ROOT_NAMESPACE, "Author", newAuthor.email);
  details = factory.newResource(ROOT_NAMESPACE, "Details", newAuthor.email);

  // Update the asset with the new value.
  author.email = newAuthor.email;
  author.firstName = newAuthor.firstName;
  author.lastName = newAuthor.lastName;
  details.password = newAuthor.password;
  author.authorId = newAuthor.transactionId;
  let authors = await participantRegistry.getAll();
  if (authors.length < 6) {
    author.isReviewer = true;
  }
  author.details = details;
  return participantRegistry
    .add(author)
    .catch(function(error) {
      console.log(error);
      let err = error;
      throw error;
    })
    .then(err => {
      if (!err) {
        request.post({
          uri: "http://172.17.0.1:1880/hello",
          json: { to: newAuthor.email, topic: "DASP - Account Created" }
        });
      }
      return detailsRegistry.add(details).catch(function(error) {
        console.log(error);
        throw error;
      });
    });
}
/**
 * Transaction for new Author, maybe not needed
 * @param {org.dasp.net.PublishRevision} publishRevision
 * @transaction
 */

async function PublishRevision(publishRevision) {
  publishRevision.revision.public = true;
  // Get the asset registry for the asset.
  const revisionRegistry = await getAssetRegistry(REVISION);
  // Update the asset in the asset registry.
  await revisionRegistry.update(publishRevision.revision);
}
/**
 * Transaction for new Author, maybe not needed
 * @param {org.dasp.net.ChangePassword} changePassword
 * @transaction
 */

async function ChangePassword(changePassword) {
  changePassword.author.password = changePassword.newPassword;
  // Get the asset registry for the asset.
  let participantRegistry = await getAssetRegistry(DETAILS);
  // Update the asset in the asset registry.
  await participantRegistry
    .update(changePassword.author)
    .then(
      await request.post({
        uri: "http://172.17.0.1:1880/hello",
        json: {
          to: changePassword.user.email,
          topic: "DASP - Password Changed",
          body: "You Password has been changed!"
        }
      })
    );
}
/**
 * Transaction for new Author, maybe not needed
 * @param {org.dasp.net.RecoverPassword} recoverPassword
 * @transaction
 */

async function RecoverPassword(recoverPassword) {
  await request.post({
    uri: "http://172.17.0.1:1880/hello",
    json: {
      to: recoverPassword.author.id,
      topic: "DASP - Account Recovered",
      body:
        "You account has been recovered!<br/>Password: " +
        recoverPassword.author.password +
        "<br/>Please change soon"
    }
  });
}

/**
 * Transaction for new Author, maybe not needed
 * @param {org.dasp.net.LogIn} logIn
 * @transaction
 */

async function LogIn(logIn) {
  return true;
}
