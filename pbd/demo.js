//TODO: rigid box and colliders?

var g_gravity = 1200;
var g_physics = new PBDSystem();
var g_engine = new Engine(g_physics);

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

var g_highlightedObject;
var g_selectedObject;
var g_selectedPinConstraint;

var g_newBody;
var g_newConstraints = [];
var g_currentConstraint;
var g_fakeEndpointVertex = new Vertex(0, 0, 1); // never gets added to a body; just used to render endpoint of constraint in progress

function OnMouseMove(event)
{
  var canvas = document.getElementById("Viewport");
  var x = event.offsetX;
  var y = canvas.height - event.offsetY;
  g_highlightedObject = g_physics.FindVertexAt(x, y);
  if (!g_highlightedObject && g_newBody)
  {
    g_highlightedObject = g_newBody.FindVertexAt(x, y);
  }

  // If constraint in progress
  if (g_currentConstraint)
  {
    g_fakeEndpointVertex.SetPosition(new Vector3(x, y, 0));
  }
/*
  if (g_selectedObject)
  {
    g_selectedPinConstraint.x = x;
    g_selectedPinConstraint.y = y;
  }
*/
}

function OnMouseDown(event)
{
  var canvas = document.getElementById("Viewport");
  var x = event.offsetX;
  var y = canvas.height - event.offsetY;

  // If editing a body...
  if (g_newBody)
  {
    var createWhat = $("#ObjectList").val();
    if (createWhat == "Vertex")
    {
      var vertex = new Vertex(x, y, 1);
      vertex.AddForce(0, -g_gravity * vertex.mass);
      g_newBody.AddVertex(vertex);
    }
    else if (createWhat == "Constraint")
    {
      var vertex = g_highlightedObject;

      if (g_currentConstraint)
      {
        // A constraint is in progress...
        if (vertex)
        {
          // Clicked on a different vertex. Finalize constraint.
          g_currentConstraint.vertex2 = vertex;
          g_currentConstraint.distance = Sub(g_currentConstraint.vertex1.Position(), g_currentConstraint.vertex2.Position()).Magnitude();
          g_currentConstraint = undefined;
        }
        else
        {
          // Clicked on nothing or same endpoint. Undo constraint.
          g_newConstraints.pop();
          g_currentConstraint = null;
        }
      }
      else if (vertex)
      {
        // New constraint
        var k = 1;
        g_currentConstraint = new DistanceConstraint(k, vertex, g_fakeEndpointVertex, 0);
        g_fakeEndpointVertex.SetPosition(vertex.Position());
        g_newConstraints.push(g_currentConstraint);
      }
    }
  }

  /*
  g_selectedObject = g_engine.FindObjectAt(x, y);
  if (g_selectedObject)
  {
    g_selectedPinConstraint = new PinConstraint(g_selectedObject, x, y);
    g_selectedObject.AddConstraint(g_selectedPinConstraint);
  }
  */
}

function OnMouseUp(event)
{
  /*
  if (g_selectedObject)
  {
    g_selectedObject.RemoveConstraint(g_selectedPinConstraint);
    delete g_selectedPinConstraint;
  }
  */
}

function OnUpdateComplete(ctx)
{
  // Draw new body in progress
  var drawables = g_newConstraints.slice();
  if (g_newBody)
  {
    drawables = drawables.concat(g_newBody.Vertices());
  }
  for (let drawable of drawables)
  {
    drawable.Draw(ctx);
  }

  // Highlighted object
  if (g_highlightedObject)
  {
    ctx.beginPath();
    ctx.arc(g_highlightedObject.Position().x, ctx.canvas.height - g_highlightedObject.Position().y, 4, 0, 360);
    ctx.fillStyle = "#88f";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }
}

function OnPauseButtonPressed()
{
  if (g_engine.physicsEnabled)
  {
    $("#StepButton").prop("disabled", false);
    $("#PauseButton").html("Resume");
    $("#CreateButton").prop("disabled", false);
    g_engine.physicsEnabled = false;
  }
  else
  {
    $("#StepButton").prop("disabled", true);
    $("#PauseButton").html("Pause");
    $("#CreateButton").prop("disabled", true);
    g_engine.physicsEnabled = true;

    // Commit body if one was being created
    //TODO: cancel current constraint if one in progress
    if (g_newBody && g_newBody.Vertices().length > 0)
    {
      g_physics.AddBody(g_newBody);
    }
    g_newBody = undefined;

    // Any any constraints
    for (let constraint of g_newConstraints)
    {
      g_physics.AddConstraint(constraint);
    }
    g_newConstraints = [];
    g_currentConstraint = undefined;
  }
}

function OnStepButtonPressed()
{
  g_engine.runPhysicsSteps = 1;
}

function OnCreateButtonPressed()
{
  //TODO: refactor constraint cancelation into a cancel function
  g_newBody = new Body();
  g_newConstraints = []
  g_currentConstraint = undefined;
}

function Demo()
{
  var i = Mult(Matrix3.Identity(), new Vector3(1, 2, 3));
  console.log("i =", i);

  var x = Matrix3.Zero();
  x.m[0] = [ 1, 2, 3 ];
  x.m[1] = [ 4, 5, 6 ];
  x.m[2] = [ 7, 8, 9 ];
  console.log("t =", x.T());

  console.log("v =", Mult(-1, new Vector3(1, 2, 3)));


  $("#Viewport").mousemove(OnMouseMove);
  $("#Viewport").mousedown(OnMouseDown);
  $("#Viewport").mouseup(OnMouseUp);
  $("#PauseButton").click(OnPauseButtonPressed);
  $("#StepButton").click(OnStepButtonPressed);
  $("#CreateButton").click(OnCreateButtonPressed);
  var canvas = document.getElementById("Viewport");
  CreateRope(canvas.width /4, canvas.height * 0.74, 300, 30);
  CreateFabric(canvas.width / 2, canvas.height * 0.80, 500, 400, 30, 20);
  g_engine.Start(OnUpdateComplete);
  g_engine.physicsEnabled = true;
}