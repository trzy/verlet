using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Rope: MonoBehaviour
{
  public float ropeLength = 1;
  public int numSegments = 10;
  public Joint connectedJoint = null;
  public bool drawSkinnedMesh = true;
  public bool drawLines = true;
  public Material material = null;
  private Verlet.System m_verlet;
  private List<Verlet.IBody> m_bodies;
  private GameObject m_lineObject;
  private LineRenderer m_line;
  private GameObject[] m_capsules;
  private SkinnedMeshRenderer m_skinnedMesh;
  private Mesh m_mesh;

  private void Update()
  {
    m_verlet.Update(Time.deltaTime);

    if (drawLines)
    {
      for (int i = 0; i < m_bodies.Count; i++)
      {
        m_line.SetPosition(i, m_bodies[i].position);
      }
    }

    if (drawSkinnedMesh)
    {
      for (int i = 0; i < m_bodies.Count; i++)
      {
        m_skinnedMesh.bones[i].position = m_bodies[i].position;
        if (i > 0)
        {
          Vector3 newUp = (m_skinnedMesh.bones[i - 1].position - m_skinnedMesh.bones[i].position).normalized;
          Quaternion rotation = m_skinnedMesh.bones[i].rotation;
          rotation.SetFromToRotation(m_skinnedMesh.bones[i].right, newUp);
          //m_mesh.bones[i].rotation = rotation;
        }
      }
      return;
    }

    // Draw capsules
    for (int i = 0; i < m_bodies.Count - 1; i++)
    {
      m_capsules[i].transform.position = 0.5f * (m_bodies[i].position + m_bodies[i + 1].position);
      //m_capsules[i].transform.up = (m_bodies[i].position - m_bodies[i + 1].position).normalized;
      Quaternion rotation = m_capsules[i].transform.rotation;
      rotation.SetFromToRotation(Vector3.up, (m_bodies[i].position - m_bodies[i + 1].position).normalized);
      m_capsules[i].transform.rotation = rotation;
    }
  }

  private void CreateSkinnedMesh()
  {
    // Generate a ring for each node. We will later connect adjacent rings to
    // form triangles. Pivot point is top of rope and we move downwards.
    List<Vector3> verts = new List<Vector3>();
    List<BoneWeight> weights = new List<BoneWeight>();
    float radius = 1;
    float segmentLength = ropeLength / numSegments;
    int numBones = numSegments + 1; // need one extra bone to cap the end
    int numSides = 100;
    int vertIdx = 0;
    for (int i = 0; i < numBones; i++)
    {
      float y = -i * segmentLength;
      for (int j = 0; j < numSides; j++)
      {
        // Create vertex
        float angle = j * (360f / numSides) * Mathf.Deg2Rad;
        float x = radius * Mathf.Cos(angle);
        float z = radius * Mathf.Sin(angle);
        verts.Add(new Vector3(x, y, z));

        // Assign weight
        BoneWeight weight = new BoneWeight();
        weight.boneIndex0 = i;
        weight.weight0 = 1;
        weight.boneIndex1 = 0;
        weight.weight1 = 0;
        weight.boneIndex2 = 0;
        weight.weight2 = 0;
        weight.boneIndex3 = 0;
        weight.weight3 = 0;
        weights.Add(weight);

        vertIdx += 1;
      }
    }

    // Connect adjacent rings with triangles
    List<int> tris = new List<int>();
    int vertsPerRing = numSides;
    vertIdx = 0;
    for (int i = 0; i < numBones - 1; i++)
    {
      // Each pair of vertices around the ring is connected with the level
      // below it to form a quad comprised of two triangles
      for (int j = 0; j < vertsPerRing; j++)
      {
        int topLeft = vertIdx + 0 + j;
        int topRight = vertIdx + (1 + j) % vertsPerRing;
        int bottomLeft = topLeft + vertsPerRing;
        int bottomRight = topRight + vertsPerRing;
        tris.Add(topLeft);
        tris.Add(bottomRight);
        tris.Add(bottomLeft);
        tris.Add(topLeft);
        tris.Add(topRight);
        tris.Add(bottomRight);
      }
      vertIdx += vertsPerRing;
    }

    // Create mesh
    m_skinnedMesh = gameObject.AddComponent<SkinnedMeshRenderer>();
    m_skinnedMesh.enabled = drawSkinnedMesh;
    m_mesh = new Mesh();
    m_mesh.vertices = verts.ToArray();
    m_mesh.triangles = tris.ToArray();
    m_mesh.RecalculateNormals();
    m_mesh.boneWeights = weights.ToArray();

    // Create bones
    Transform[] bones = new Transform[numBones];
    Matrix4x4[] bindPoses = new Matrix4x4[numBones];
    for (int i = 0; i < numBones; i++)
    {
      bones[i] = new GameObject("Bone" + i).transform;
      bones[i].parent = transform;
      bones[i].localRotation = Quaternion.identity;
      bones[i].localPosition = new Vector3(0, -i * segmentLength, 0);

      // Bind pose is inverse transform matrix
      bindPoses[i] = bones[i].worldToLocalMatrix * transform.localToWorldMatrix;
    }

    // Hook up bones and mesh
    m_mesh.bindposes = bindPoses;
    m_skinnedMesh.bones = bones;
    m_skinnedMesh.sharedMesh = m_mesh;
    m_skinnedMesh.sharedMaterial = material;
  }

  private void OnDestroy()
  {
    Object.Destroy(m_mesh);
  }

  private void CreateCapsules()
  {
    if (drawSkinnedMesh)
      return;
    float segmentLength = ropeLength / numSegments;
    m_capsules = new GameObject[m_bodies.Count - 1];
    for (int i = 0; i < m_bodies.Count - 1; i++)
    {
      m_capsules[i] = GameObject.CreatePrimitive(PrimitiveType.Capsule);
      m_capsules[i].transform.localScale = new Vector3(0.05f, 0.5f * segmentLength, 0.05f);
    }
  }

  private void Awake()
  {
    m_verlet = new Verlet.System();
    m_bodies = new List<Verlet.IBody>();

    // Construct rope with anchor assumed to be at pivot of this object
    Verlet.Anchor anchor = new Verlet.Anchor(transform);
    m_verlet.AddBody(anchor);
    m_bodies.Add(anchor);
    float segmentLength = ropeLength / numSegments;
    int numPoints = numSegments + 1;
    for (int i = 1; i < numPoints; i++)
    {
      Verlet.IBody point;
      if (connectedJoint && i == numPoints - 1)
        point = new Verlet.Anchor(connectedJoint);
        //point = new Verlet.Anchor(anchor.position + 0.25f * Vector3.right);
      else
        point = new Verlet.PointMass(transform.position - segmentLength * transform.up * i, 1);
      Verlet.IBody lastPoint = m_bodies[m_bodies.Count - 1];
      Verlet.IConstraint link = new Verlet.LinkConstraint(lastPoint, point, segmentLength, 1f);
      point.AddConstraint(link);
      point.AddForce(new Vector3(0, -9.8f * point.mass, 0));
      m_verlet.AddBody(point);
      m_bodies.Add(point);
    }

    // Debug line renderer
    if (drawLines)
    {
      m_lineObject = new GameObject("line");
      m_line = m_lineObject.AddComponent<LineRenderer>();
      m_line.startWidth = .01f;
      m_line.endWidth = .01f;
      m_line.startColor = Color.red;
      m_line.endColor = Color.red;
      m_line.positionCount = numSegments;
      //m_line.material = material;
    }

    // Capsule-based visualization
    CreateCapsules();

    // Skinned mesh
    CreateSkinnedMesh();
  }
}
