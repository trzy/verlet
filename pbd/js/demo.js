/*
 * demo.js
 * Bart Trzynadlowski, 2020
 *
 * Main program.
 */

//TODO: rigid box and colliders?

var g_gravity = 1200;
var g_physics = new PBDSystem();
var g_engine = new Engine(g_physics);
var g_currentOperation = new EditOperation();
var g_currentEditedBody = null;

function CreateRope(x, y, length, numSegments)
{
  var rope = new Body();
  g_physics.AddBody(rope);

  var anchor = new AnchorVertex(x, y, 1);
  rope.AddVertex(anchor);

  // Create N bodies
  var segments = [ anchor ];
  var segmentLength = length / numSegments;
  for (var i = 0; i < numSegments; i++)
  {
    var vertex = new Vertex(x + (i + 1) * segmentLength, y, 1);
    vertex.AddForce(0, -g_gravity * vertex.mass);
    rope.AddVertex(vertex);
    segments.push(vertex);
  }

  // Make the end of the rope heavy
  segments[segments.length - 1].SetMass(10);

  // Create N constraints: 1 external (the first one), N-1 internal
  var kStiffness = 1;
  for (var i = 0; i < numSegments; i++)
  {
    var vertex1 = segments[i + 0];
    var vertex2 = segments[i + 1];
    var distance = Math.abs(vertex1.Position().x - vertex2.Position().x);
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
  var y = canvas.height - event.offsetY;
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

function OnPauseButtonPressed()
{
  if (g_engine.physicsEnabled)
  {
    // Pause pressed
    $("#StepButton").prop("disabled", false);
    $("#PauseButton").html("Resume");
    g_engine.physicsEnabled = false;
  }
  else
  {
    // Resume pressed
    $("#StepButton").prop("disabled", true);
    $("#PauseButton").html("Pause");
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
  $("#PauseButton").click(OnPauseButtonPressed);
  $("#StepButton").click(OnStepButtonPressed);
  $("#NewBodyButton").click(OnNewBodyButtonPressed);
  $("#CreationOperation").change(OnCreationOperationListChanged);
  OnCreationOperationListChanged(); // pick up initial value
  var canvas = document.getElementById("Viewport");
  CreateRope(canvas.width /4, canvas.height * 0.74, 300, 30);
  CreateFabric(canvas.width / 2, canvas.height * 0.80, 500, 400, 30, 20);
  g_engine.Start(OnUpdateComplete);
  g_engine.physicsEnabled = true;
}