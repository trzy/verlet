/*
 * demo.js
 * Bart Trzynadlowski, 2020
 *
 * Main program.
 */


var g_gravity = 1200;
var g_physics = new PBDSystem();
var g_engine = new Engine(g_physics);
var g_currentOperation = new EditOperation();
var g_currentEditedBody = null;


function CreateBox(center, size)
{
  var box = new Body();
  g_physics.AddBody(box);

  var topLeft = new Vertex(center.x - 0.5 * size.x, center.y + 0.5 * size.y, 1);
  var topRight = new Vertex(center.x + 0.5 * size.x, center.y + 0.5 * size.y, 1);
  var bottomRight = new Vertex(center.x + 0.5 * size.x, center.y - 0.5 * size.y, 1);
  var bottomLeft = new Vertex(center.x - 0.5 * size.x, center.y - 0.5 * size.y, 1);
  box.AddVertex(topLeft);
  box.AddVertex(topRight);
  box.AddVertex(bottomRight);
  box.AddVertex(bottomLeft);

  var kStiffness = 1

  // Perimeter constraints
  g_physics.AddConstraint(new DistanceConstraint(kStiffness, topLeft, topRight, Vector3.Distance(topLeft.Position(), topRight.Position())));
  g_physics.AddConstraint(new DistanceConstraint(kStiffness, bottomLeft, bottomRight, Vector3.Distance(bottomLeft.Position(), bottomRight.Position())));
  g_physics.AddConstraint(new DistanceConstraint(kStiffness, topLeft, bottomLeft, Vector3.Distance(topLeft.Position(), bottomLeft.Position())));
  g_physics.AddConstraint(new DistanceConstraint(kStiffness, topRight, bottomRight, Vector3.Distance(topRight.Position(), bottomRight.Position())));

  // Inner constraints to make box rigid
  g_physics.AddConstraint(new DistanceConstraint(kStiffness, topLeft, bottomRight, Vector3.Distance(topLeft.Position(), bottomRight.Position())));
  g_physics.AddConstraint(new DistanceConstraint(kStiffness, topRight, bottomLeft, Vector3.Distance(topRight.Position(), bottomLeft.Position())));

  // Gravity
  for (let vertex of box.Vertices())
  {
    vertex.AddForce(0, -g_gravity * vertex.mass);
  }
}

function CreateRope(start, dir, length, numSegments, anchored)
{
  var rope = new Body();
  g_physics.AddBody(rope);

  var anchor = anchored ? new AnchorVertex(start.x, start.y, 1) : new Vertex(start.x, start.y, 1);
  anchor.AddForce(0, -g_gravity * anchor.mass);
  rope.AddVertex(anchor);

  // Create N bodies
  var segments = [ anchor ];
  var segmentLength = length / numSegments;
  for (var i = 0; i < numSegments; i++)
  {
    var vertex = new Vertex(start.x + (i + 1) * dir.x * segmentLength, start.y + (i + 1) * dir.y * segmentLength, 1);
    vertex.AddForce(0, -g_gravity * vertex.mass);
    rope.AddVertex(vertex);
    segments.push(vertex);
  }

  // Create N constraints: 1 external (the first one), N-1 internal
  var kStiffness = 1;
  for (var i = 0; i < numSegments; i++)
  {
    var vertex1 = segments[i + 0];
    var vertex2 = segments[i + 1];
    var distance = Vector3.Distance(vertex1.Position(), vertex2.Position());
    var constraint = new DistanceConstraint(kStiffness, vertex1, vertex2, distance);
    g_physics.AddConstraint(constraint);
  }
}

function CreateFabric(x, y, width, height, numSegmentsX, numSegmentsY)
{
  var fabric = new Body();
  g_physics.AddBody(fabric);

  var stiffness = 1;
  var segmentWidth = width / numSegmentsX;
  var segmentHeight = height / numSegmentsY;
  var points = [];
  for (var i = 0; i < numSegmentsY; i++)
  {
    points[i] = [];
    for (var j = 0; j < numSegmentsX; j++)
    {
      var xPos = x + j * segmentWidth;
      var yPos = y - i * segmentHeight;

      // Top row are anchor points
      //var pt = i == 0 ? new AnchorVertex(xPos, yPos, 1) : new Vertex(xPos, yPos, 1);
      var pt = new Vertex(xPos, yPos, 1);

      if (j > 0)
      {
        var leftPt = points[i][points[i].length - 1];
        var link = new DistanceConstraint(stiffness, leftPt, pt, segmentWidth);
        g_physics.AddConstraint(link);
      }

      if (i == 0)
      {
        // Top row is pinned (we use pin constraints because two AnchorVertexes cannot be constrainted together due to weight NaN)
        g_physics.AddConstraint(new AnchorConstraint(pt, pt.Position().x, pt.Position().y));
      }
      else
      {
        var topPt = points[i - 1][j];
        var link = new DistanceConstraint(stiffness, topPt, pt, segmentHeight);
        g_physics.AddConstraint(link);
      }
      points[i].push(pt);
      fabric.AddVertex(pt);
    }
  }

  // Add gravity
  for (var i = 1; i < points.length; i++)
  {
    for (var j = 0; j < points[i].length; j++)
    {
      points[i][j].AddForce(0, -g_gravity * points[i][j].mass);
    }
  }
}

function CreateFallingRopeAndBoxCollider(boxCenter, boxSize, ropeHeightAboveBoxCenter, ropeWidth, numSegments)
{
  var box = new AARectangleCollider(boxCenter, boxSize.x, boxSize.y);
  g_physics.AddCollider(box);

  var ropeStart = boxCenter.Copy();
  ropeStart.x -= ropeWidth * 0.5;
  ropeStart.y += ropeHeightAboveBoxCenter;
  CreateRope(ropeStart, Vector3.Right(), ropeWidth, numSegments, false);
}

function CreateNewBody()
{
  if (g_currentEditedBody)
  {
    // A body was being edited. If no vertices were added, remove it.
    if (g_currentEditedBody.Vertices().length <= 0)
    {
      g_physics.RemoveBody(g_currentEditedBody);
    }

    // Set its color back to default
    for (let vertex of g_currentEditedBody.Vertices())
    {
      vertex.fillColor = Vertex.defaultFillColor;
      vertex.strokeColor = Vertex.defaultStrokeColor;
    }

    g_currentEditedBody = null;
  }

  // Create a new body
  g_currentEditedBody = new Body();
  g_physics.AddBody(g_currentEditedBody);

  // New body was created. Need to create new edit operation in case old one
  // was using this body.
  OnCreationOperationListChanged();
}

function OnMouseMove(event)
{
  var canvas = document.getElementById("Viewport");
  var x = event.offsetX;
  var y = canvas.height - event.offsetY;  // convert to simulation coordinates where +y is up
  g_currentOperation.OnMouseMove(x, y);
}

function OnMouseDown(event)
{
  var canvas = document.getElementById("Viewport");
  var x = event.offsetX;
  var y = canvas.height - event.offsetY;
  g_currentOperation.OnMouseDown(x, y);
}

function OnMouseUp(event)
{
}

function OnUpdateComplete(ctx)
{
  // Current operation
  g_currentOperation.Draw(ctx);
}

function OnRunButtonPressed()
{
  if (g_engine.physicsEnabled)
  {
    // Pause pressed
    $("#StepButton").prop("disabled", false);
    $("#RunButton").html("Resume");
    g_engine.physicsEnabled = false;
  }
  else
  {
    // Resume (or initially, Start) pressed
    $("#StepButton").prop("disabled", true);
    $("#RunButton").html("Pause");
    g_engine.physicsEnabled = true;
  }
}

function OnStepButtonPressed()
{
  g_engine.runPhysicsSteps = 1;
}

function OnNewBodyButtonPressed()
{
  CreateNewBody();
}

function OnCreationOperationListChanged()
{
  g_currentOperation.Cancel();

  var operation = $("#CreationOperation").val();
  if (operation == "Vertex")
  {
    if (!g_currentEditedBody)
    {
      // If no body being edited, create one
      CreateNewBody();
    }
    g_currentOperation = new CreateVertexOperation(g_currentEditedBody, "#0ff");
  }
  else if (operation == "Constraint")
  {
    g_currentOperation = new CreateConstraintOperation(g_physics);
  }
  else if (operation == "AARectangleCollider")
  {
    g_currentOperation = new CreateAARectangleColliderOperation(g_physics);
  }
  else if (operation == "CollisionProbe")
  {
    g_currentOperation = new CreateCollisionProbeOperation(g_physics);
  }
}

function OnIterationsChanged()
{
  var value = $("#Iterations").val();
  value = Math.floor(Math.min(Math.max(value, 1), 25));
  $("#Iterations").val(value);
  g_physics.physicsSolverIterations = value;
}

function OnDampingChanged()
{
  g_physics.kDamping = parseFloat($("#Damping").val());
}

function Demo()
{
  /*
  // Math tests
  var i = Mult(Matrix3.Identity(), new Vector3(1, 2, 3));
  console.log("i =", i);

  var x = Matrix3.Zero();
  x.m[0] = [ 1, 2, 3 ];
  x.m[1] = [ 4, 5, 6 ];
  x.m[2] = [ 7, 8, 9 ];
  console.log("t =", x.T());

  console.log("v =", Mult(-1, new Vector3(1, 2, 3)));
  */

  $("#Viewport").mousemove(OnMouseMove);
  $("#Viewport").mousedown(OnMouseDown);
  $("#Viewport").mouseup(OnMouseUp);
  $("#RunButton").click(OnRunButtonPressed);
  $("#StepButton").click(OnStepButtonPressed);
  $("#NewBodyButton").click(OnNewBodyButtonPressed);
  $("#CreationOperation").change(OnCreationOperationListChanged);
  OnCreationOperationListChanged(); // pick up initial value
  $("#Iterations").change(OnIterationsChanged);
  OnIterationsChanged();
  $("#Damping").change(OnDampingChanged);
  OnDampingChanged();

  var canvas = document.getElementById("Viewport");

  // Swinging rope
  CreateRope(new Vector3(canvas.width / 4, canvas.height * 0.74, 0), Vector3.Right(), 300, 30, true);

  // Fabric
  //CreateFabric(canvas.width / 2, canvas.height * 0.80, 500, 400, 30, 20);

  // Falling rope and colliding box. Rope should wrap around the sides of box.
  var boxCenter = new Vector3(0.6 * canvas.width, canvas.height * 0.3, 0);
  var boxSize = new Vector3(0.2 * canvas.height, 0.15 * canvas.width, 0);
  CreateFallingRopeAndBoxCollider(boxCenter, boxSize, 0.4 * canvas.height, 0.3 * canvas.width, 20);

  // Faling box
  CreateBox(new Vector3(boxCenter.x + 60, boxCenter.y + 500, 0), new Vector3(100, 100, 0));

  g_engine.Start(OnUpdateComplete);
  g_engine.physicsEnabled = false;
}